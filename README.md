# Correspondencia Unificada

Sistema integral de gestion documental y correspondencia para la Municipalidad de Cabo de Hornos, Puerto Williams. Combina tres modulos principales en una sola plataforma.

## Arquitectura

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 18 + TypeScript + Material UI (Vite) |
| Backend | Laravel 10 (PHP 8.2) |
| Base de datos | MySQL 8.0 |
| Infraestructura | Docker Compose |

## Modulos

### Correspondencia
Gestion de correspondencia entrante con derivaciones entre departamentos, seguimiento de estado y adjuntos PDF.

**Flujo principal:**
1. Oficial de Partes ingresa correspondencia (estado: `pendiente`)
2. Oficial/Admin puede editar mientras este en estado `pendiente`
3. Oficial/Admin deriva a Alcalde (estado: `derivada_alcaldia`)
4. Alcalde revisa y deriva a Funcionario con providencia PDF (estado: `derivada_funcionario`)
5. Funcionario marca como recibida (estado: `completada`)

**Estados:**
| Estado | Descripcion |
|--------|-------------|
| `pendiente` | Recien ingresada, editable |
| `derivada_alcaldia` | Enviada al Alcalde para revision |
| `derivada_funcionario` | Alcalde la derivo a un departamento |
| `completada` | Funcionario confirmo recepcion |
| `archivado` | Archivada |

### OIRS (Oficina de Informaciones, Reclamos y Sugerencias)
Portal publico para que ciudadanos ingresen solicitudes (consultas, reclamos, sugerencias, felicitaciones). Panel de administracion para asignacion, derivacion y respuesta de solicitudes.

### Gestor Documental
Creacion de documentos oficiales (decretos, resoluciones, oficios, memorandums, certificados, convenios) a partir de plantillas con variables dinamicas. Sistema de firma digital (simulada), expedientes electronicos con indice y correlativos automaticos.

## Prerrequisitos

- Docker y Docker Compose
- Git

## Quick Start (Desarrollo)

```bash
# Clonar el repositorio
git clone https://github.com/joyarzov/gestorunificado.git
cd gestorunificado

# Levantar todos los servicios
chmod +x start.sh
./start.sh
```

### URLs de desarrollo

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API Backend | http://localhost:8000/api |
| phpMyAdmin | http://localhost:8081 |

## Despliegue en Produccion

```bash
# En el servidor
chmod +x start-prod.sh
./start-prod.sh
```

Esto:
1. Construye las imagenes de produccion (frontend compilado + nginx, backend PHP)
2. Levanta MySQL, backend y frontend
3. Ejecuta migraciones y seeders
4. La app queda disponible en el puerto 8888

### Arquitectura de produccion

```
[Cliente] --> :8888 --> [Nginx (frontend)]
                              |
                              | /api/* --> [Backend Laravel :8000]
                              |                    |
                              |              [MySQL :3306]
```

El frontend se compila a archivos estaticos y se sirve con Nginx, que tambien actua como reverse proxy para las peticiones `/api/*` hacia el backend.

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
│   ├── resources/views/pdf/ # Templates PDF (providencia)
│   └── routes/api.php
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── api/            # Capa de comunicacion con API
│   │   ├── pages/          # Vistas organizadas por modulo
│   │   ├── components/     # Componentes reutilizables
│   │   ├── contexts/       # AuthContext (roles, permisos)
│   │   └── types/          # Tipos TypeScript
│   ├── public/
│   ├── Dockerfile          # Produccion (build + nginx)
│   ├── Dockerfile.dev      # Desarrollo (Vite dev server)
│   └── nginx.conf          # Config nginx produccion
├── docker-compose.yml      # Desarrollo
├── docker-compose.prod.yml # Produccion
├── start.sh                # Script inicio desarrollo
├── start-prod.sh           # Script inicio produccion
└── stop.sh                 # Script parada
```

## Endpoints principales de la API

### Autenticacion
- `POST /api/auth/login` - Iniciar sesion (RUT + password)
- `POST /api/auth/logout` - Cerrar sesion
- `GET /api/auth/me` - Usuario autenticado

### Correspondencia
- `GET /api/correspondencia` - Listar correspondencia
- `POST /api/correspondencia` - Crear correspondencia
- `PUT /api/correspondencia/{id}` - Actualizar correspondencia
- `GET /api/correspondencia/{id}` - Detalle correspondencia
- `GET /api/correspondencia/bandeja` - Bandeja de entrada
- `GET /api/correspondencia/search` - Busqueda avanzada
- `GET /api/correspondencia/estadisticas` - Estadisticas
- `GET /api/correspondencia/{id}/providencia` - Descargar providencia PDF
- `POST /api/derivaciones` - Derivar correspondencia
- `POST /api/derivaciones/{id}/recibir` - Marcar como recibida

### OIRS
- `POST /api/oirs-publico` - Crear solicitud (publico)
- `GET /api/oirs-publico/consultar` - Consultar estado (publico)
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

| Rol | RUT | Password | Descripcion |
|-----|-----|----------|-------------|
| Admin/Alcalde | 17033946-0 | 152015 | Acceso completo, puede derivar a funcionarios |
| Oficial de Partes | 12345678-9 | oficial123 | Ingreso y gestion de correspondencia |
| Funcionario | 11111111-1 | funcionario123 | Recepcion de correspondencia derivada |

## Cambios recientes

### v1.1 - Mejoras Correspondencia
- **Boton Editar**: Solo visible para oficial/admin cuando estado=`pendiente`
- **Providencia PDF estilo Decreto**: Rediseño con Times New Roman, logo, estructura formal
- **Nuevos estados**: `derivada_funcionario` y `completada` para mejor trazabilidad
- **Marcar como Recibida**: Funcionario puede confirmar recepcion de correspondencia derivada
- **Configuracion produccion**: Docker Compose para produccion con nginx reverse proxy
