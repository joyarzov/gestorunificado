#!/bin/bash

# Script de inicio para Correspondencia Unificada
# Uso: ./start.sh

set -e

echo "================================================"
echo "  Iniciando Correspondencia Unificada"
echo "================================================"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

cd "$(dirname "$0")"

# Verificar que Docker esté corriendo
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker no está corriendo. Por favor, inicie Docker Desktop primero.${NC}"
    exit 1
fi

# Detener contenedores antiguos si existen
echo -e "${YELLOW}Deteniendo contenedores anteriores...${NC}"
docker-compose down 2>/dev/null || true

# Limpiar builds anteriores
echo -e "${YELLOW}Limpiando builds anteriores...${NC}"
docker-compose build --no-cache

# Levantar contenedores
echo -e "${YELLOW}Iniciando contenedores...${NC}"
docker-compose up -d

# Esperar a que MySQL esté listo
echo -e "${YELLOW}Esperando a que MySQL esté listo...${NC}"
sleep 15

# Verificar que el backend esté corriendo
echo -e "${YELLOW}Verificando backend...${NC}"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose exec -T backend php -v > /dev/null 2>&1; then
        echo -e "${GREEN}Backend PHP está listo${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo "Esperando backend... intento $attempt de $max_attempts"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}El backend no respondió a tiempo. Revise los logs con: docker-compose logs backend${NC}"
    exit 1
fi

# Generar APP_KEY
echo -e "${YELLOW}Generando APP_KEY...${NC}"
docker-compose exec -T backend php artisan key:generate --force || true

# Ejecutar migraciones
echo -e "${YELLOW}Ejecutando migraciones...${NC}"
docker-compose exec -T backend php artisan migrate --force

# Ejecutar seeders
echo -e "${YELLOW}Ejecutando seeders...${NC}"
docker-compose exec -T backend php artisan db:seed --force

# Crear link simbólico para storage
echo -e "${YELLOW}Configurando storage...${NC}"
docker-compose exec -T backend php artisan storage:link 2>/dev/null || true

# Limpiar cache
echo -e "${YELLOW}Limpiando cache...${NC}"
docker-compose exec -T backend php artisan config:clear
docker-compose exec -T backend php artisan cache:clear

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ¡Sistema iniciado correctamente!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "  Frontend:     http://localhost:5173"
echo "  Backend API:  http://localhost:8000/api"
echo "  phpMyAdmin:   http://localhost:8081"
echo ""
echo "  Usuarios de prueba:"
echo ""
echo "    Admin:        RUT: 17033946-0  | Password: 152015"
echo "    Oficial:      RUT: 12345678-9  | Password: oficial123"
echo "    Funcionario:  RUT: 11111111-1  | Password: funcionario123"
echo ""
echo "  Para ver logs: docker-compose logs -f"
echo "  Para detener:  docker-compose down"
echo ""
