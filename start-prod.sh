#!/bin/bash
set -e

echo "============================================"
echo " Correspondencia Unificada - Producción"
echo "============================================"

# Verificar que Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker no está corriendo"
    exit 1
fi

echo ""
echo "[1/7] Construyendo imágenes de producción..."
docker compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "[2/7] Levantando servicios..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "[3/7] Esperando a que MySQL esté listo..."
sleep 10
until docker compose -f docker-compose.prod.yml exec mysql mysqladmin ping -h localhost --silent 2>/dev/null; do
    echo "  Esperando MySQL..."
    sleep 3
done
echo "  MySQL está listo."

echo ""
echo "[4/7] Esperando a que el backend esté listo..."
MAX_RETRIES=30
RETRY=0
until docker compose -f docker-compose.prod.yml exec backend php -r "echo 'ok';" 2>/dev/null | grep -q "ok"; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -ge $MAX_RETRIES ]; then
        echo "ERROR: Backend no responde después de $MAX_RETRIES intentos"
        exit 1
    fi
    echo "  Intento $RETRY/$MAX_RETRIES..."
    sleep 3
done
echo "  Backend está listo."

echo ""
echo "[5/7] Generando APP_KEY..."
docker compose -f docker-compose.prod.yml exec backend php artisan key:generate --force

echo ""
echo "[6/7] Ejecutando migraciones y seeders..."
docker compose -f docker-compose.prod.yml exec backend php artisan migrate --force
docker compose -f docker-compose.prod.yml exec backend php artisan db:seed --force

echo ""
echo "[7/7] Configurando storage y caché..."
docker compose -f docker-compose.prod.yml exec backend php artisan storage:link 2>/dev/null || true
docker compose -f docker-compose.prod.yml exec backend php artisan config:clear
docker compose -f docker-compose.prod.yml exec backend php artisan route:clear
docker compose -f docker-compose.prod.yml exec backend php artisan view:clear

echo ""
echo "============================================"
echo " ¡Despliegue completado!"
echo "============================================"
echo ""
echo " App: https://doc.australbyte.cl:8888"
echo ""
echo " Usuarios de prueba:"
echo "   Admin:        17033946-0 / 152015"
echo "   Oficial:      12345678-9 / oficial123"
echo "   Funcionario:  11111111-1 / funcionario123"
echo ""
echo "============================================"
