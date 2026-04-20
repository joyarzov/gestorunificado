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

### Administracion
Gestion de usuarios, departamentos, plantillas documentales, firma y sellos, configuracion institucional y **organigrama interactivo** con estructura jerarquica de la municipalidad. Permite asignar jefaturas, mover funcionarios entre departamentos y visualizar el arbol organizacional completo.

## Escritorio por modulo

Cada modulo tiene su propio escritorio aislado con sidebar contextual y dashboard con informacion relevante. El switcher de modulos (icono 9-puntos en la topbar) permite saltar entre ellos sin volver al Portal.

- **Correspondencia**: KPIs, recientes y accesos rapidos. "Ingresar correspondencia" solo visible para Oficial de Partes y Admin.
- **Cero Papel**: Pendientes de firma, recibidos sin leer, distribucion de documentos por estado.
- **OIRS**: Solicitudes abiertas, SLA por vencer, distribucion por tipo, asignadas al usuario.

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
- `POST /api/expedientes/{id}/cerrar` - Cerrar expediente (solo creador o admin)
- `POST /api/expedientes/{id}/reabrir` - Reabrir expediente (solo creador o admin)
- `POST /api/expedientes/{id}/asociar-documento` - Asociar documento existente
- `POST /api/expedientes/{id}/subir-documento` - Subir PDF a expediente
- `GET /api/documentos` - Listar documentos
- `POST /api/documentos` - Crear documento desde plantilla
- `POST /api/documentos/{id}/enviar-firma` - Enviar a firma
- `POST /api/documentos/{id}/firmar` - Firmar documento
- `GET /api/documentos/plantillas` - Listar plantillas disponibles

### Organigrama
- `GET /api/organigrama` - Arbol completo con jefes, subrogantes e integrantes
- `POST /api/organigrama/departamentos` - Crear unidad (nombre, codigo, tipo, parent_id, jefe_id)
- `PATCH /api/organigrama/departamentos/{id}` - Editar nombre, codigo, tipo, activo
- `PATCH /api/organigrama/departamentos/{id}/parent` - Mover bajo otra unidad
- `PATCH /api/organigrama/departamentos/{id}/jefe` - Asignar o remover jefatura
- `PATCH /api/organigrama/usuarios/{user}/departamento` - Mover funcionario (solo admin)
- `PATCH /api/organigrama/mi-subrogante` - El usuario autenticado define su subrogante

## Usuarios de prueba

| Rol | RUT | Password | Descripcion |
|-----|-----|----------|-------------|
| Admin/Alcalde | 17033946-0 | 152015 | Acceso completo, puede derivar a funcionarios |
| Oficial de Partes | 12345678-9 | oficial123 | Ingreso y gestion de correspondencia |
| Funcionario | 11111111-1 | funcionario123 | Recepcion de correspondencia derivada |

## Cambios recientes

### v1.1.0 - Organigrama, dashboards por modulo y sidebar contextual (2026-04-20)

**Escritorio reorganizado por modulo**
- Cada modulo (Correspondencia, Cero Papel, OIRS, Fomento Productivo, Administracion) tiene su propio escritorio con sidebar contextual — ya no se mezclan los items de todos los modulos.
- Switcher de modulos (icono 9-puntos) en la topbar para saltar entre escritorios sin volver al Portal.
- Dashboards por modulo con KPIs reales desde API: total/pendientes/en proceso, actividad reciente, accesos rapidos filtrados por rol.
- En Correspondencia, "Ingresar correspondencia" solo visible para Oficial de Partes y Admin.

**Organigrama interactivo** (`/organigrama`, solo admin)
- Arbol jerarquico con React Flow + dagre auto-layout.
- Estructura oficial cargada desde el organigrama 2016 de la Municipalidad de Cabo de Hornos (43 unidades: Alcaldia, Admin Municipal, SECPLA, Secretaria Municipal, Control, DAF con 7 secciones, DOM con 3 sub-unidades, DIDECO con 8 oficinas).
- Ramas colapsables: botones "Expandir todo", "Colapsar" y "Ajustar" + chevron por nodo con hijos.
- Menu contextual por nodo: editar datos (nombre, codigo, tipo), asignar jefatura, mover bajo otra unidad, agregar sub-unidad.
- Panel lateral con detalle del depto seleccionado: jefatura, subrogante del jefe e integrantes.
- Boton "mover a otro departamento" por cada integrante (solo admin).
- Perfil de usuario: campo para definir su propio subrogante.

**Permisos y seguridad**
- Cerrar/reabrir expediente ahora requiere ser el creador del expediente o tener rol admin (antes cualquier usuario autenticado podia hacerlo).
- `PATCH /api/organigrama/usuarios/{user}/departamento` valida rol admin antes de mover funcionarios.

**Cambios de esquema**
- `departamentos`: +`parent_id`, +`jefe_id`, +`tipo`, +`orden`.
- `users`: +`subrogante_id`.
- Migracion: `2026_04_19_000001_add_organigrama_fields`.
- Seeder: `OrganigramaSeeder` (idempotente por codigo, desactiva unidades obsoletas sin tocar usuarios).

### v1.1 - Mejoras Correspondencia
- **Boton Editar**: Solo visible para oficial/admin cuando estado=`pendiente`
- **Providencia PDF estilo Decreto**: Rediseño con Times New Roman, logo, estructura formal
- **Nuevos estados**: `derivada_funcionario` y `completada` para mejor trazabilidad
- **Marcar como Recibida**: Funcionario puede confirmar recepcion de correspondencia derivada
- **Configuracion produccion**: Docker Compose para produccion con nginx reverse proxy
