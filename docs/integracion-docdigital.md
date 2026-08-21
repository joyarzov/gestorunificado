# Integración con las APIs de Gobierno Digital

> Estudio de factibilidad y plan de trabajo — 21 de agosto de 2026
> Sistema: Correspondencia Unificada · I. Municipalidad de Cabo de Hornos
> APIs evaluadas: **Codificador** (identidad de organismos y listas controladas) y **DocDigital** (envío y recepción de documentos)

## Resumen

Son dos APIs distintas y complementarias, con costos de entrada muy distintos:

| | Codificador | DocDigital |
|---|---|---|
| Qué resuelve | **Quién es quién** en el Estado: código oficial de cada organismo + listas controladas de gestión documental | **Mover documentos**: recibir y despachar correspondencia oficial entre organismos |
| Autenticación | Ninguna — API pública de lectura | OAuth2 con credenciales por entidad |
| Trámite previo | **Ninguno** | Registro en DemoDoc + credenciales + certificación de la DGD |
| Se puede empezar | **Hoy** | Después de la habilitación |
| Esfuerzo | 1–2 días | ~2 semanas de desarrollo |

Conviene partir por el Codificador: es gratis, inmediato, y deja el terreno preparado
(catálogo de destinatarios normalizado) para cuando DocDigital esté habilitado.

---

# Parte I · DocDigital

## Veredicto

**Sí es posible, y el sistema ya cumple el requisito más duro.**

DocDigital expone una API REST (OAuth2 + Bearer JWT) pensada exactamente para esto:
conectar gestores documentales propios para **enviar y recibir documentos oficiales
automáticamente** entre órganos del Estado. El requisito bloqueante es que todo
documento que se despache tenga **Firma Electrónica Avanzada válida** — y este sistema
ya firma con FirmaGob (SEGPRES) e incluso verifica firmas embebidas con
`PdfSignatureDetector` (poppler `pdfsig`).

El trabajo de desarrollo es acotado (~2 semanas). **El camino crítico es administrativo**:
registro de la institución en el ambiente DemoDoc, generación de credenciales API y
**certificación obligatoria de la integración por la División de Gobierno Digital (DGD)**
antes de tocar producción.

Un detalle no menor: **la DGD no trata con proveedores**. La interlocución debe hacerla
el Coordinador de Transformación Digital del municipio; Australbyte trabaja detrás de esa
contraparte.

---

## 1. Qué ofrece la API (verificado sobre el spec en vivo)

- **Producto**: DocDigital APIv2 — "API RESTful con protocolo OAuth2 para el envío y
  recepción de documentos en DocDigital v3", versión `3.2.515` (OpenAPI 3.1).
- **Producción**: `https://api-doc.digital.gob.cl/api`
- **Demo (DemoDoc)**: `https://api-demodoc.digital.gob.cl/api`
- **Spec público** (no requiere token): `/api/swagger-docs/public`
- **Contacto**: soporte@digital.gob.cl

### 1.1 Autenticación

OAuth2 *client credentials* clásico de Spring Security:

```
POST /api/oauth/token
Authorization: Basic base64(clientId:clientSecret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

Sondeado en vivo contra DemoDoc: con credenciales falsas responde
`401 · "ClientId no registrado."`, lo que confirma el formato. El `access_token`
resultante se envía como `Authorization: Bearer <token>` en todas las llamadas.

Las credenciales las genera **el Administrador de usuarios de la institución** dentro de
DocDigital (submenú Administración → "Credenciales API"), previo permiso "Administrar
credenciales de API". Si el municipio tiene entidades dependientes, hay que crear
credenciales **para cada entidad que deba recibir documentación**.

### 1.2 Endpoints (los 20 del spec, agrupados por uso)

**Recepción — lo que nos llega de otros órganos del Estado**

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/documentos/recibidos` | Bandeja de entrada de la entidad del token. Filtros útiles: `notificado` (acuse dado sí/no), `distribuido`, `fechaInicioFolio`/`fechaFinFolio`, `tipoDocumentoId`, `entidadDestinataria`, `pageSize`/`pageNumber` |
| PUT | `/documentos/recibidos/{id}/acusorecibo` | **Acusar recibo oficial** (body opcional: `entidadDestinataria`) |
| PUT | `/documentos/recibidos/{id}/devolver` | **Devolver/rechazar** con `motivo` (3–255 caracteres) |
| GET | `/documentos/{id}` | Ficha completa del documento (no reservado) |
| GET | `/documentos/{id}/archivo/descargar` | Descarga el PDF (principal o anexo vía `archivo_id`) |
| GET | `/documentos/{id}/estado` | Estado actual + historial de eventos (fecha, evento, usuario, entidad) |

**Despacho — lo que enviamos**

| Método | Ruta | Para qué |
|---|---|---|
| POST | `/documentos/firmado/ingresar` | **Cargar un PDF ya firmado con FEA y despacharlo** a las entidades destinatarias |
| PUT | `/documentos/{id}/atributos-adicionales` | Metadatos extra (mapa clave/valor) |
| GET | `/documentos/creados`, `/documentos/creados/enviados`, `/documentos/buscar` | Seguimiento de lo emitido |

**Catálogos**

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/entidades/token` | Entidades activas asociadas al token (autodiagnóstico) |
| GET | `/entidades/` | Catálogo de entidades del Estado — alimenta el selector de destinatarios |
| GET | `/usuarios/` | Usuarios/destinatarios por entidad, RUN, o rol (1=tramitador, 2=OP Salida, 3=OP Entrada, 4=Admin) |
| GET | `/tipos/documentos/` | Tipos documentales de DocDigital (`tipo_id`) |
| GET | `/tipos/visaciones/` | Tipos de visación |

Deprecados y a evitar desde el día uno: `/documentos/firmado/borrador`, `/layouts/`,
`/documentos/{id}/archivo`, `/documentos/{id}/reservado/archivo`, y los filtros
`limit`, `descripcion`, `runCreador`, `nombreFirmante`, etc.

### 1.3 Payload de despacho (`SolicitudDocumentoRequest`)

Obligatorios: `tipo_id`, `materia` (1–150), `nombre`, `documento` (PDF en base64, máx.
**20 MB**), `id_entidad_creadora`, `folio`, `listado_id_entidades_destinatarias`.
Opcionales relevantes: `descripcion` (1–250), `es_reservado`, `run_usuario_creador`,
`listado_id_usuarios_destinatarios`, `documentos_anexos[]` (base64 o URL, máx. **50 MB**
cada uno).

Devuelve `id_documento`, `id_solicitud`, `fecha_ingreso` y los ids de los anexos.

**El folio lo pone el emisor.** Es decir: la serie de folios que ya lleva este sistema
(`OF-`, `ORD-`, `CIRC-`, `CARTA-` vía `Correspondencia::TIPOS_SALIDA`) sigue siendo la
fuente de verdad. DocDigital no renumera.

### 1.4 Formato de respuesta

Todas las respuestas usan un sobre uniforme —
`{status, message, errorCode, error, count, timestamp, result, total_count, total_pages, page}` —
casi idéntico al `ApiResponse<T>` que ya usa este sistema. El mapeo es directo.

Fechas de filtro en `dd-MM-yyyy`. Ojo con el ya conocido desfase UTC vs `America/Punta_Arenas`.

**No hay webhooks**: la recepción es por *polling*.

---

## 2. Requisitos habilitantes (previos al código)

Según el documento oficial "Introducción a API DocDigital" de la DGD:

1. **Plataforma que emita y almacene PDF con FEA.** ✅ Ya lo hacemos (FirmaGob + verificación con `pdfsig`). Documentos sin FEA no se admiten.
2. **Revisar la normativa**: Guía de Gestión Documental, Metadatos PV1 y su adaptación en DocDigital.
3. **Institución registrada en DemoDoc.** Lo solicita el Coordinador de Transformación Digital.
4. **Generar credenciales API** por entidad (ver 1.1).
5. **Pruebas de integración** de tres casos de uso: recepción, devolución e ingreso/envío efectivo.
6. **Certificación obligatoria de la DGD** siguiendo el documento "Certificación de Integraciones para API DocDigital", con evidencias enviadas por https://digital.gob.cl/incidencia. Sin esto **no hay acceso a producción**.
7. Soporte y consultas por el mismo canal de incidencias.

---

## 3. Encaje con el sistema actual

La buena noticia: no hay que rediseñar nada. Los dos puntos de inserción ya existen y
están bien delimitados.

### 3.1 Entrada — hoy es 100 % manual

`CorrespondenciaController::store()` (`backend/app/Http/Controllers/CorrespondenciaController.php:135`)
crea la correspondencia con `folio = Correspondencia::siguienteFolio('ING')`,
`direccion = 'entrada'`, `estado = 'pendiente'` y el remitente escrito a mano.

Con DocDigital, ese mismo registro lo crea un job. Mapeo campo a campo:

| Correspondencia (local) | DocDigital (`DocumentoResponse`) |
|---|---|
| `numero_documento` | `documento_principal.folio` |
| `remitente` | nombre de `entidad_creadora_id` (resuelto contra el catálogo de entidades) |
| `fecha_documento` | `documento_principal.fechaFolio` |
| `fecha_recibo` | fecha de ingesta local |
| `descripcion` | `documento_principal.materia` + `descripcion` |
| `documento_ruta` / `documento_nombre` | PDF de `/documentos/{id}/archivo/descargar` |
| adjuntos (`CorrespondenciaAdjunto`) | `documentos_anexos[]` (descarga con `archivo_id`) |
| `folio` | `siguienteFolio('ING')` — correlativo propio, no viene de DocDigital |

Y las dos acciones que hoy no existen:

- **Acuse de recibo** → `PUT /documentos/recibidos/{id}/acusorecibo`.
  ⚠️ **No debe dispararse al ingerir.** El acuse tiene efecto oficial frente al órgano
  remitente; se envía cuando Oficina de Partes efectivamente recibe el documento en la
  aplicación. Ingesta y acuse son dos momentos distintos.
- **Devolver a origen** → `PUT /documentos/recibidos/{id}/devolver` con motivo. Es un
  botón nuevo en el detalle de la correspondencia de entrada, solo para Oficina de Partes.

### 3.2 Salida — encaja como un nuevo "medio de despacho"

`CorrespondenciaSalidaController` ya modela el ciclo
`reservada → por_despachar → despachada` con desvíos `devuelta` y `anulada`, y
`despachar()` (línea 295) guarda `medio_despacho`, `fecha_despacho` y
`referencia_despacho`.

Basta con:

1. Agregar `docdigital` a `MEDIOS_DESPACHO` (línea 25).
2. Cuando se elige ese medio, exigir **entidades destinatarias** de DocDigital (selector nuevo).
3. Verificar la FEA del PDF con `PdfSignatureDetector` **antes** de enviar (si no tiene firma válida, DocDigital lo rechaza; mejor fallar temprano y con un mensaje claro).
4. `POST /documentos/firmado/ingresar` con el PDF de `documento_ruta` en base64, `folio = $salida->folio`, `materia = descripcion` (truncada a 150), `tipo_id` mapeado desde el tipo documental local y `run_usuario_creador` = RUN del firmante (sin guion ni DV, como pide la API).
5. Guardar `id_documento` e `id_solicitud`, y usar `referencia_despacho` para mostrar el identificador DocDigital en el libro y en la ficha.

El resto del flujo (notificaciones, chip "Respondida", libro de correspondencia) queda
intacto.

### 3.3 Componentes nuevos

```
backend/
  app/Services/DocDigital/
    DocDigitalClient.php        # token cacheado + HTTP + manejo del sobre de respuesta
    DocDigitalRecepcion.php     # ingesta de recibidos, acuse, devolución
    DocDigitalDespacho.php      # armado y envío de /documentos/firmado/ingresar
  app/Console/Commands/
    DocDigitalSincronizarRecibidos.php   # scheduler cada 15 min
    DocDigitalSincronizarCatalogos.php   # entidades y tipos, diario
  config/docdigital.php
  database/migrations/
    ..._add_docdigital_a_correspondencia.php
    ..._create_docdigital_entidades.php
    ..._create_docdigital_tipos.php
```

Columnas nuevas en `correspondencia`:
`docdigital_documento_id` (**unique**, nullable — es la llave de idempotencia),
`docdigital_solicitud_id`, `docdigital_entidad_creadora_id`, `docdigital_acuse_at`,
`docdigital_sync_error`.

Configuración (`.env`), siguiendo el patrón de `config/firmagob.php`:

```
DOCDIGITAL_ENABLED=false
DOCDIGITAL_BASE_URL=https://api-demodoc.digital.gob.cl/api
DOCDIGITAL_CLIENT_ID=
DOCDIGITAL_CLIENT_SECRET=
DOCDIGITAL_ENTIDAD_ID=
```

Un flag por ambiente permite dejar el código desplegado y apagado hasta que llegue la
certificación.

---

---

# Parte II · Codificador

## 4. Qué es y por qué importa

El **Codificador** (https://codificador.digital.gob.cl) es la plataforma de Gobierno
Digital que asigna y publica **el código único de cada organismo del Estado**, más las
**listas controladas** de la norma de gestión documental. Es la fuente oficial de "quién
es quién" para interoperar.

Su API **es pública y no requiere credenciales, cuenta ni trámite**. Verificado en vivo.

⚠️ **La documentación oficial está desactualizada**: la página "¿Cómo usar la API?"
apunta a `https://codificacion.digital.gob.cl/api/v{version}/...`, dominio que **ya no
resuelve** (NXDOMAIN). El servicio vivo es:

```
https://api.codificador.digital.gob.cl
```

sin el prefijo `/api/v1` que muestra la documentación.

### 4.1 Endpoints verificados

| Ruta | Qué devuelve |
|---|---|
| `GET /codificaciones` | Las 7 codificaciones: Instituciones (1), Códigos Únicos Territoriales (2), Oficina de Partes (3), Tipos de organismos (5), Procedimientos Administrativos (31), Listas Controladas (32) |
| `GET /codigos/{idCodificacion}?descripcion=&codigo=&padre=` | Códigos de una codificación. `descripcion=` vacío devuelve **todo el catálogo** |

Volúmenes reales medidos: **6.203 organismos** (codificación 1, incluidas **1.438
municipalidades**), 418 códigos territoriales, 58 tipos de organismo, 61.606
procedimientos administrativos, 409 listas controladas. La codificación "Oficina de
Partes" está vigente pero **hoy viene vacía**.

### 4.2 El municipio ya tiene código oficial

```
GET /codigos/1?descripcion=cabo%20de%20hornos
```

```json
{ "codigo": "PE-MUN-00426",
  "descripcion": "Municipalidad de Cabo de Hornos",
  "identificador": "1.PE-MUN-00426",
  "info_extra": { "tipo": "MUN", "cod_comuna": "12201", "cod_region": "12",
                  "poder_del_estado": "PE", "afecta_ley_21180": 1 },
  "vigente": true }
```

Ese `PE-MUN-00426` es el identificador con que el resto del Estado nos reconoce.
Vecinos útiles: `PE-GOR-00564` (Gobierno Regional de Magallanes), `PE-DPR-00635`
(Delegación Presidencial Regional).

### 4.3 Las listas controladas coinciden con campos que ya existen

La codificación 32 contiene exactamente los vocabularios que el modelo `Documento` ya
implementa:

| Lista | Valores oficiales | Campo local |
|---|---|---|
| `LCGD001` Tipo Documental | 42 valores: Acta, Circular, Decreto, Memorándum, Oficio, Resolución… | `tipo_documental_id` |
| `LCGD003` Origen del documento | Repositorio externo, Físico, Digital, Digitalización, Plataforma ciudadana, Otro | `origen_carga` |
| `LCGD004` Mecanismo de incorporación | Manual, Servicio web, Mixto, Repositorio ciudadano, Interoperabilidad | `mecanismo_incorporacion` |
| `LCGD008` Nivel de acceso | Público, Restringido, **Secreto**, **Reservado** | `nivel_acceso` |
| `LCGD009` Tipo Firma | Avanzada, Simple, Otro, No certificada | firmas del documento |

**Hallazgo a corregir**: el sistema documenta `nivel_acceso` como
`1=Público, 2=Restringido, 3=Reservado, 4=Secreto`
(`database/migrations/2024_01_01_000032_create_expedientes_table.php:24`), pero la lista
oficial ordena **3=Secreto, 4=Reservado**. Internamente da lo mismo, pero al exponer
metadatos hacia afuera hay que mapear explícitamente, no asumir que el número calza.

### 4.4 Qué gana el sistema con esto

- **Remitente y destinatario dejan de ser texto libre.** Hoy `correspondencia.remitente` es un `varchar(255)` que cada quien escribe distinto ("SUBDERE", "Subdere", "Subsecretaría de Desarrollo Regional"). Con el catálogo del Codificador se elige de una lista y se guarda además el código oficial.
- **Estadísticas confiables**: "cuánto oficia el municipio al GORE" deja de depender de cómo se escribió el nombre.
- **Preparación para DocDigital**: el mismo catálogo alimenta el selector de entidades destinatarias, y el código oficial es la llave para cruzar con `/entidades/` de DocDigital.
- **Metadatos alineados a la norma** sin inventar vocabularios propios.

### 4.5 Implementación

Una tabla `organismos_estado` (código, descripción, tipo, comuna, región, vigente) y otra
`listas_controladas`, ambas alimentadas por un comando `codificador:sincronizar` mensual.
Cliente HTTP simple, sin autenticación, con caché local: si la API no responde, el
catálogo local sigue sirviendo. **1–2 días de trabajo, sin dependencias externas.**

### 4.6 Dónde se enchufa, pantalla por pantalla

**Idea rectora: no reemplazar el campo, enriquecerlo.** `correspondencia.remitente` sigue
siendo el `varchar(255)` de siempre; se agrega al lado `remitente_codigo` (nullable). El
input pasa a ser un Autocomplete que igual permite escribir libre. Los registros
históricos no se tocan, no hay migración de datos, y la normalización ocurre sola a
medida que se usa.

| Paso del flujo | Archivo | Qué cambia |
|---|---|---|
| Ingreso de correspondencia de entrada | `frontend/src/pages/correspondencia/Create.tsx:236` | El `TextField` "Remitente" pasa a Autocomplete contra el catálogo |
| Reserva de folio de salida | `frontend/src/pages/correspondencia/Salidas.tsx:377` y `:406` | Mismo componente en "Destinatario externo" |
| Administración | `frontend/src/pages/admin/Administracion.tsx` | Tarjeta con la última sincronización y botón para forzarla |

El Autocomplete es un solo componente reutilizado en los tres lugares; el patrón ya
existe en `ExpedienteDetail.tsx:1184` (selector de departamentos).

**Backend:**

| Archivo | Qué hace |
|---|---|
| `database/migrations/..._create_organismos_estado.php` | Catálogo local: código, descripción, tipo, comuna, región, vigente |
| `database/migrations/..._add_remitente_codigo_a_correspondencia.php` | La columna nueva, nullable |
| `app/Services/Codificador/CodificadorClient.php` | Cliente HTTP sin autenticación, tolerante a caídas |
| `app/Console/Commands/CodificadorSincronizar.php` | Baja los 6.203 organismos con `updateOrCreate` |
| `app/Console/Kernel.php:15` | Una línea: `$schedule->command('codificador:sincronizar')->monthly()` |
| `app/Http/Controllers/OrganismoController.php` | `GET /api/organismos?q=` para el Autocomplete |

Se sincroniza a tabla y no se consulta en vivo: si el Codificador se cae, el catálogo
local sigue respondiendo.

**Orden de trabajo**

1. Migración + comando de sincronización; verificar que bajen los 6.203 registros (medio día).
2. Endpoint de búsqueda + componente Autocomplete en los tres puntos (medio día).
3. Push → `git pull` en el CT124 → probar con remitentes reales → producción.

Cuando DocDigital quede habilitado, a `organismos_estado` se le agrega
`docdigital_entidad_id` y el mismo catálogo alimenta el selector de entidades
destinatarias. Por eso conviene este orden y no el inverso.


---

## 5. Plan de trabajo por fases

| Fase | Qué | Quién | Esfuerzo |
|---|---|---|---|
| **FC · Codificador** | Catálogo de organismos del Estado y listas controladas, selector de remitente/destinatario normalizado. **Sin trámite, se puede hacer ya** | Dev | 1–2 días |
| **F0 · Habilitación** | Registro en DemoDoc, permiso "Administrar credenciales de API", generación de credenciales por entidad | Municipio (Coord. Transformación Digital) + Australbyte de apoyo | Trámite: 2–4 semanas |
| **F1 · Cliente y catálogos** | `DocDigitalClient` con token cacheado, sincronización de entidades y tipos, pantalla de diagnóstico en Admin (`/entidades/token`). Solo lectura, riesgo cero | Dev | ~1 día |
| **F2 · Recepción** | Job de ingesta + descarga de PDF y anexos + acuse manual desde la app + devolución con motivo. Contra DemoDoc | Dev | 2–3 días |
| **F3 · Despacho** | Medio `docdigital` en salidas, selector de entidades destinatarias, validación de FEA, envío y registro de identificadores. Contra DemoDoc | Dev | 2–3 días |
| **F4 · Certificación** | Ejecutar los 3 casos de uso exigidos, reunir evidencias, completar el documento de certificación y enviarlo por digital.gob.cl/incidencia | Municipio firma / Australbyte prepara | 1–2 días + espera DGD |
| **F5 · Producción** | Credenciales productivas, cambio de `DOCDIGITAL_BASE_URL`, piloto en paralelo con el registro manual por 2–4 semanas | Dev + Oficina de Partes | ~1 día + piloto |

**Total de desarrollo: ~2 semanas.** El calendario real lo fija F0 y F4.

Orden de despliegue: como siempre — local → push → `git pull` en el CT124 de pruebas
(192.168.4.252) → recién ahí producción (CT106).

---

## 6. Riesgos y puntos de atención

| Riesgo | Mitigación |
|---|---|
| **Sin certificación no hay producción** | Empezar F0 ya; el desarrollo puede avanzar en paralelo sobre DemoDoc |
| **La DGD no trata con proveedores** | Toda gestión pasa por el Coordinador de Transformación Digital del municipio |
| **Documentos sin FEA son rechazados** | Validar con `PdfSignatureDetector` antes de enviar y bloquear el despacho con mensaje claro |
| **Duplicados en la ingesta** | `docdigital_documento_id` con índice único + `updateOrCreate` |
| **Acuse automático prematuro** | Separar ingesta de acuse: el acuse lo dispara Oficina de Partes desde la app |
| **base64 de 20/50 MB** | Subir `memory_limit` y `post_max_size` en el contenedor backend; procesar por archivo, no todo en memoria |
| **`pageSize` por defecto = 50.000** | Paginar siempre explícito (`pageSize=200`) y filtrar por fecha en la primera carga |
| **Sin webhooks** | Polling cada 15 min con backoff; registrar errores en `docdigital_sync_error` y avisar al admin |
| **Entidades dependientes del municipio** | Definir en F0 si se opera con una entidad única o varias; afecta credenciales y el uso de `entidadDestinataria` |
| **Endpoints deprecados** | Usar desde el inicio `/{id}/archivo/descargar`, `tipo_id`, `pageSize`/`pageNumber` |
| **Zona horaria** | Fechas `dd-MM-yyyy`; fijar display en `America/Punta_Arenas` (ver nota histórica del proyecto) |

---

## 7. Qué gana el municipio

- La correspondencia oficial de otros órganos del Estado **entra sola** a la bandeja, con
  su PDF y sus anexos, sin retipeo ni descargas manuales desde doc.digital.gob.cl.
- El acuse de recibo y la devolución se hacen **desde el mismo sistema** donde se deriva y
  se responde, sin cambiar de plataforma.
- Los oficios de salida se despachan a otras instituciones **sin salir del flujo de firma**
  que ya existe, conservando el folio institucional.
- Trazabilidad completa: el historial de DocDigital (`/documentos/{id}/estado`) queda
  disponible junto a la trazabilidad interna.

---

## Fuentes

- Spec OpenAPI en vivo: https://api-doc.digital.gob.cl/api/swagger-docs/public (Swagger UI: https://api-doc.digital.gob.cl/api/swagger-ui/index.html)
- "Introducción a API DocDigital", División de Gobierno Digital: https://manualesdocdigital.s3-us-west-2.amazonaws.com/Intro-APIDocDigital.pdf
- Kit de habilitación: https://manualesdocdigital.s3-us-west-2.amazonaws.com/DocDigital_Kit_habilitacion.pdf
- Ruta de implementación: https://manualesdocdigital.s3-us-west-2.amazonaws.com/Ruta_implementacion_DocDigital.pdf
- Wiki Guías SGD: https://wikiguias.digital.gob.cl/es/Manuales
- Codificador — documentación (desactualizada en las URLs): https://codificador.digital.gob.cl/como-usar-la-api/
- Codificador — API viva verificada: https://api.codificador.digital.gob.cl/codificaciones
