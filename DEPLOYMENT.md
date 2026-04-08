# Deployment - Correspondencia Unificada

## Servidor: `doc.australbyte.cl`

- **Acceso SSH**: `root@doc.australbyte.cl`
- **URL pública**: `https://doc.australbyte.cl`
- **Ruta en servidor**: `/root/correspondencia-unificada/`

---

## Estructura del proyecto en servidor

```
/root/correspondencia-unificada/
├── docker-compose.prod.yml      # Orquestación producción
├── docker-compose.yml           # Orquestación desarrollo
├── start-prod.sh / start.sh / stop.sh
│
├── backend/
│   ├── Dockerfile               # PHP 8.2-cli + extensiones + Composer
│   ├── .env                     # Config producción
│   ├── app/
│   │   ├── Http/Controllers/    # DocumentoController, ExpedienteController, etc.
│   │   ├── Models/              # Documento, Expediente, Derivacion, etc.
│   │   ├── Services/
│   │   └── Providers/
│   ├── config/                  # app, auth, cors, database, sanctum, etc.
│   ├── database/
│   │   ├── migrations/          # 45 migraciones (incluye orden + verificación)
│   │   └── seeders/
│   ├── routes/api.php           # Todas las rutas API
│   ├── resources/views/         # Blade templates (PDF providencia)
│   ├── storage/app/public/      # logo.png y archivos subidos
│   └── public/index.php
│
├── frontend/
│   ├── Dockerfile               # Node 20 build → Nginx Alpine
│   ├── nginx.conf               # Proxy /api → backend:8000 + SPA fallback
│   ├── public/logo.png          # Logo municipalidad
│   ├── src/
│   │   ├── App.tsx              # Router principal
│   │   ├── api/                 # gestor.ts, common.ts, dashboard.ts, etc.
│   │   ├── pages/               # Portal, gestor/, admin/, correspondencia/, etc.
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── types/index.ts
│   │   └── utils/
│   └── dist/                    # Build compilado (servido por Nginx)
│
└── nginx/                       # Config nginx adicional
```

---

## Contenedores Docker

| Container | Imagen | Puerto | Rol |
|---|---|---|---|
| `corresp_frontend` | `correspondencia-unificada-frontend` (Nginx Alpine) | `0.0.0.0:80 → 80` | Sirve SPA + proxy `/api` al backend |
| `corresp_backend` | `correspondencia-unificada-backend` (PHP 8.2-cli) | `8000` (interno) | Laravel API (`php artisan serve`) |
| `corresp_mysql` | `mysql:8.0` | `3306` (interno) | Base de datos MySQL |

Todos los contenedores están en la red `corresp_network` y se comunican por nombre de servicio.

---

## Flujo de red

```
Internet → HTTPS (doc.australbyte.cl)
  → Nginx (puerto 80)
    → /api/* → proxy_pass → backend:8000 (Laravel)
    → /*     → SPA (index.html) → React app
```

---

## Comandos de despliegue

### Subir cambios al servidor

```bash
# Sincronizar archivos locales al servidor
rsync -avz --exclude='node_modules' --exclude='vendor' --exclude='.git' \
  --exclude='.env' --exclude='storage/logs' \
  -e "sshpass -p 'CONTRASEÑA' ssh -o StrictHostKeyChecking=no" \
  ./ root@doc.australbyte.cl:/root/correspondencia-unificada/
```

### Reconstruir y reiniciar contenedores

```bash
ssh root@doc.australbyte.cl
cd /root/correspondencia-unificada

# Rebuild con cache
docker compose -f docker-compose.prod.yml build

# Rebuild sin cache (cambios en Dockerfile o dependencias)
docker compose -f docker-compose.prod.yml build --no-cache

# Levantar contenedores
docker compose -f docker-compose.prod.yml up -d
```

### Ejecutar migraciones

```bash
docker exec corresp_backend php artisan migrate --force
```

### Limpiar caches de Laravel

```bash
docker exec corresp_backend php artisan config:clear
docker exec corresp_backend php artisan cache:clear
docker exec corresp_backend php artisan route:clear
```

### Ver logs

```bash
# Logs de contenedores
docker logs corresp_backend --tail 50
docker logs corresp_frontend --tail 50

# Log de Laravel
docker exec corresp_backend tail -50 /var/www/html/storage/logs/laravel.log
```

---

## Base de datos

- **Motor**: MySQL 8.0
- **Host interno**: `mysql` (nombre del servicio Docker)
- **Base de datos**: `correspondencia_unificada`
- **Usuario**: `unificada_user`
- **Volumen persistente**: `corresp_mysql_data`

### Acceder a MySQL

```bash
docker exec -it corresp_mysql mysql -u unificada_user -p correspondencia_unificada
```

---

## Dockerfiles

### Backend (`backend/Dockerfile`)
- Base: `php:8.2-cli`
- Extensiones: pdo_mysql, mbstring, exif, pcntl, bcmath, gd, zip
- Composer instalado desde imagen oficial
- Comando: `php artisan serve --host=0.0.0.0 --port=8000`

### Frontend (`frontend/Dockerfile`)
- Build stage: `node:20-alpine` → `npm run build` (Vite + TypeScript)
- Production stage: `nginx:alpine` → sirve `/dist` con `nginx.conf` personalizado

---

## Nginx (`frontend/nginx.conf`)

- Proxy reverso: `/api` → `http://backend:8000`
- SPA fallback: `try_files $uri $uri/ /index.html`
- Gzip habilitado
- Cache de assets estáticos: 1 año con `immutable`

---

## Pitfalls conocidos

### Dependencias npm que requieren compilación nativa (ej. `react-pdf`, `canvas`, `sharp`)

**Problema:** La producción corre el frontend con `vite` en modo dev y un volumen mount que expone el código fuente del host. Si se agrega una dependencia npm que no está instalada en el host (o que requiere binarios nativos distintos), Vite falla al resolver el import con un error como:

```
[vite:import-analysis] Failed to resolve import "react-pdf" from "src/..."
```

**Causa raíz:** El `docker-compose.yml` monta el directorio del proyecto como volumen (`./frontend:/app`). Esto incluye `node_modules/` del host, que sobreescribe el `node_modules/` que Docker instaló al construir la imagen. Si la dependencia no existe en el host, no existe en el contenedor.

**Regla:** Preferir dependencias que solo usen APIs del browser o código JS puro. Evitar librerías que requieran workers, WASM o binarios nativos si no están garantizadas en el host.

**Ejemplos de alternativas seguras:**
- Visor de PDF: usar `<iframe src={url} />` nativo en lugar de `react-pdf`
- Procesamiento de imágenes: usar Canvas API nativo en lugar de `sharp`

**Si igualmente se necesita agregar una dependencia pesada:** ejecutar `npm install` dentro del contenedor después del deploy:

```bash
docker exec unificada_frontend npm install nombre-paquete
```

O bien instalarla también en el host de desarrollo antes de hacer commit del `package-lock.json`.

### No borrar usuarios de la BD al redesplegar

El volumen MySQL (`unificada_mysql_data`) persiste entre deploys. El script `deploy.sh` corre `php artisan migrate` (no `migrate:fresh`), por lo que los datos existentes no se tocan. **Nunca correr `migrate:fresh` en producción.**
