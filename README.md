# Correspondencia Unificada

Sistema integral de gestión documental y correspondencia para la Municipalidad de Cabo de Hornos, Puerto Williams. Combina tres módulos principales en una sola plataforma.

## Arquitectura

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Material UI (Vite) |
| Backend | Laravel 11 (PHP 8.2) |
| Base de datos | MySQL 8.0 |
| Infraestructura | Docker Compose |

## Módulos

### Correspondencia
Gestión de correspondencia entrante y saliente con derivaciones entre departamentos, seguimiento de estado y adjuntos.

### OIRS (Oficina de Informaciones, Reclamos y Sugerencias)
Portal público para que ciudadanos ingresen solicitudes (consultas, reclamos, sugerencias, felicitaciones). Panel de administración para asignación, derivación y respuesta de solicitudes.

### Gestor Documental
Creación de documentos oficiales (decretos, resoluciones, oficios, memorándums, certificados, convenios) a partir de plantillas con variables dinámicas. Sistema de firma digital (simulada), expedientes electrónicos con índice y correlativos automáticos.

## Prerrequisitos

- Docker y Docker Compose
- Git

## Quick Start

```bash
# Clonar el repositorio
git clone https://github.com/joseoyarzovera/GestorDocumentalUnificado.git
cd GestorDocumentalUnificado

# Levantar todos los servicios
docker compose up -d

# Ejecutar migraciones y seeders (primera vez)
docker exec unificada_backend php artisan migrate --seed
```

## URLs de desarrollo

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API Backend | http://localhost:8000/api |
| phpMyAdmin | http://localhost:8081 |

## Estructura del proyecto

```
.
├── backend/                # Laravel API
│   ├── app/
│   │   ├── Http/Controllers/
│   │   └── Models/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── routes/api.php
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── api/            # Capa de comunicación con API
│   │   ├── pages/          # Vistas organizadas por módulo
│   │   ├── components/     # Componentes reutilizables
│   │   └── types/          # Tipos TypeScript
│   └── public/
├── nginx/                  # Configuración Nginx
├── docker-compose.yml
├── start.sh
└── stop.sh
```

## Endpoints principales de la API

### Autenticación
- `POST /api/auth/login` - Iniciar sesión (RUT + password)
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Usuario autenticado

### Correspondencia
- `GET /api/correspondencia` - Listar correspondencia
- `POST /api/correspondencia` - Crear correspondencia
- `GET /api/correspondencia/bandeja` - Bandeja de entrada
- `POST /api/derivaciones` - Derivar correspondencia

### OIRS
- `POST /api/oirs-publico` - Crear solicitud (público)
- `GET /api/oirs-publico/consultar` - Consultar estado (público)
- `GET /api/oirs` - Listar solicitudes (admin)
- `POST /api/oirs/{id}/asignar` - Asignar solicitud
- `POST /api/oirs/{id}/responder` - Responder solicitud

### Gestor Documental
- `GET /api/expedientes` - Listar expedientes
- `POST /api/expedientes` - Crear expediente
- `POST /api/expedientes/{id}/asociar-documento` - Asociar documento existente
- `POST /api/expedientes/{id}/subir-documento` - Subir PDF a expediente
- `GET /api/documentos` - Listar documentos
- `POST /api/documentos` - Crear documento desde plantilla
- `POST /api/documentos/{id}/enviar-firma` - Enviar a firma
- `POST /api/documentos/{id}/firmar` - Firmar documento
- `GET /api/documentos/plantillas` - Listar plantillas disponibles

## Usuarios de prueba

| Rol | RUT | Password | Descripción |
|-----|-----|----------|-------------|
| Admin | 17033946-0 | 152015 | Acceso completo a todos los módulos |
| Oficial de Partes | 12345678-9 | oficial123 | Gestión de correspondencia |
| Funcionario | 11111111-1 | funcionario123 | Usuario general |
