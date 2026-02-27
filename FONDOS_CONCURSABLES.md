# Módulo Fondo Concursable "Tu Negocio Crece"

## Descripción

Módulo para digitalizar el proceso de postulación al fondo concursable "Tu Negocio Crece 2025" de la Municipalidad de Cabo de Hornos. Incluye portal ciudadano para postulación online y panel de gestión para funcionarios de Fomento Productivo.

## Usuarios del Sistema

| Rol | RUT | Contraseña | Descripción |
|-----|-----|------------|-------------|
| Admin + Fomento | `17033946-0` | `152015` | Administrador con acceso a todos los módulos |
| Fomento Productivo | `22222222-2` | `152015` | Encargado de Fomento Productivo |

## Flujos Principales

### 1. Postulación Ciudadana (sin autenticación)

```
Portal Ciudadano (/) → Tarjeta "Tu Negocio Crece" → Dialog informativo
  ├── "Ver Bases" → descarga PDF
  └── "Postular" → /fondos/postular
        └── Formulario 5 pasos:
            1. Datos del Emprendedor (nombre, RUT, email, teléfono, etc.)
            2. Datos del Emprendimiento (rubro, antigüedad, patente, etc.)
            3. Plan de Negocio (descripción, objetivos, estrategia, etc.)
            4. Plan de Financiamiento (tabla Anexo II editable)
            5. Documentos Adjuntos (cédula, RSH, cotizaciones, etc.)
        → Enviar → Código alfanumérico TNC-XXXXXX
```

### 2. Seguimiento Ciudadano

```
/fondos/seguimiento → Código + RUT → Estado actual de la postulación
```

### 3. Gestión Fomento Productivo

```
Login → Portal → Fomento Productivo → /fomento-productivo
  ├── Dashboard con estadísticas
  └── Fondo → /fondos-concursables/:id (listado postulaciones)
        └── Detalle → /postulaciones/:id
              ├── Ver formulario completo + adjuntos
              ├── Código visible (para informar al ciudadano)
              ├── Evaluar → /postulaciones/:id/evaluar (rúbrica 8 criterios)
              ├── Aprobar (con monto)
              └── Rechazar (con observaciones)
```

## Rúbrica de Evaluación (100 puntos)

| # | Criterio | Peso |
|---|----------|------|
| 1 | Claridad y Coherencia del Proyecto | 25% |
| 2 | Impacto Económico Local | 15% |
| 3 | Innovación | 15% |
| 4 | Asociatividad | 5% |
| 5 | Sustentabilidad del Proyecto | 10% |
| 6 | Estrategia Comercial y Marketing | 15% |
| 7 | Proveedores Locales | 10% |
| 8 | Participación en Charla | 5% |

Escala por criterio: 0, 25, 50, 75, 100. Aprobación >= 80%.

## Rutas

### Públicas (sin autenticación)

| Ruta Frontend | Descripción |
|---------------|-------------|
| `/fondos/postular` | Formulario nueva postulación |
| `/fondos/postular/:codigo` | Retomar borrador |
| `/fondos/seguimiento` | Consultar estado |

### API Públicas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/fondos-publico/activo` | Fondo abierto actual |
| GET | `/api/fondos-publico/{id}/bases` | Descargar PDF bases |
| POST | `/api/fondos-publico/postular` | Crear postulación |
| PUT | `/api/fondos-publico/postulacion/{codigo}` | Guardar borrador |
| POST | `/api/fondos-publico/postulacion/{codigo}/enviar` | Enviar postulación |
| POST | `/api/fondos-publico/postulacion/{codigo}/adjunto` | Subir adjunto |
| DELETE | `/api/fondos-publico/postulacion/{codigo}/adjunto/{id}` | Eliminar adjunto |
| GET | `/api/fondos-publico/consultar` | Consultar estado |

### Protegidas (rol: admin, fomento_productivo)

| Ruta Frontend | Descripción |
|---------------|-------------|
| `/fomento-productivo` | Dashboard |
| `/fondos-concursables/:id` | Lista postulaciones |
| `/postulaciones/:id` | Detalle postulación |
| `/postulaciones/:id/evaluar` | Evaluar con rúbrica |

### API Admin

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/fondos-concursables` | Listar fondos |
| POST | `/api/fondos-concursables` | Crear fondo |
| GET | `/api/fondos-concursables/{id}` | Detalle fondo |
| PUT | `/api/fondos-concursables/{id}` | Actualizar fondo |
| POST | `/api/fondos-concursables/{id}/bases` | Subir PDF bases |
| GET | `/api/fondos-concursables/{id}/postulaciones` | Listar postulaciones |
| GET | `/api/fondos-concursables/{id}/estadisticas` | Estadísticas |
| GET | `/api/postulaciones/{id}` | Detalle postulación |
| POST | `/api/postulaciones/{id}/evaluar` | Evaluar |
| POST | `/api/postulaciones/{id}/aprobar` | Aprobar |
| POST | `/api/postulaciones/{id}/rechazar` | Rechazar |
| GET | `/api/postulaciones/{id}/ficha` | Ficha postulación |

## Base de Datos

### `fondos_concursables`
Fondos concursables con estado (borrador/abierto/cerrado/evaluacion/finalizado), montos y fechas.

### `postulaciones`
Postulaciones con código alfanumérico único (TNC-XXXXXX), formulario en JSON, estado y evaluación.

### `postulacion_items_financiamiento`
Tabla normalizada del Anexo II (plan de financiamiento) para reportes y agregación.

### `postulacion_adjuntos`
Documentos adjuntos con tipo (cédula, RSH, cotizaciones, etc.).

## Archivos Principales

### Backend
- `app/Http/Controllers/FondoPublicoController.php` — endpoints públicos
- `app/Http/Controllers/FondoConcursableController.php` — endpoints admin
- `app/Models/FondoConcursable.php`, `Postulacion.php`, `PostulacionItemFinanciamiento.php`, `PostulacionAdjunto.php`
- `database/seeders/FondoConcursableSeeder.php`

### Frontend
- `src/api/fondos.ts` — capa API
- `src/pages/fondos/PostulacionForm.tsx` — formulario multi-paso
- `src/pages/fondos/SeguimientoPostulacion.tsx` — consulta pública
- `src/pages/fondos/FomentoProductivoDashboard.tsx` — dashboard admin
- `src/pages/fondos/PostulacionesList.tsx` — listado postulaciones
- `src/pages/fondos/PostulacionDetail.tsx` — detalle + aprobar/rechazar
- `src/pages/fondos/PostulacionEvaluar.tsx` — rúbrica evaluación
- `src/components/fondos/FondoInfoDialog.tsx` — popup informativo
- `src/components/fondos/FinanciamientoTable.tsx` — tabla Anexo II
