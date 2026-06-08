# Plan técnico — Mantenedor de plantillas y render por bloques (Opción B)

> Objetivo: que los documentos del módulo **cero papel** puedan **verse y estructurarse como providencias** (membrete, secciones, firma y pie con QR anclados, folio automático) y que un administrador controle **estructura y estilo** desde un **mantenedor**, sin tocar código.
>
> Este plan está basado en un análisis del código real (verificado) y consolida dos diseños independientes (uno minimalista, uno robusto). Estado: **propuesta para revisión y aprobación**.

---

## 1. Diagnóstico (situación actual, verificada)

Hoy conviven **dos motores de documentos que no comparten nada**:

| | **Cero papel** | **Providencia** |
|---|---|---|
| Plantilla | Tabla `documento_plantillas` (HTML en BD con `{{var}}`) | Blade hardcodeado `resources/views/pdf/providencia.blade.php` |
| Render | `DocumentoController::procesarPlantilla()` (`str_replace`) + `Documento::generarPdfFinal()` (`<style>` serif fijo) | `ProvidenciaPdfService` + `Pdf::loadView()` |
| Firma / QR | DIV flotante heurístico (`inyectarFooterVerificacion`) | `position:fixed` (firma y pie con QR) |
| Folio | El `numero` lo escribe el usuario a mano | Automático `PROV-AAAA-NNNNN` |
| Mantenedor | **No existe** (solo seeder) | Hardcodeado en el Blade |

**El diseño que se busca (providencia) ya existe y está bien hecho**, pero encerrado en un Blade fijo y solo disponible para derivaciones. El objetivo es **generalizar ese diseño** a cualquier plantilla de cero papel y hacerlo **configurable**.

### Columnas actuales de `documento_plantillas` (verificadas)
`id, nombre, codigo (unique), tipo_documental_id (FK), contenido_html (longText), variables_json (json), activo (bool), descripcion (text), requiere_firma (bool), requiere_aprobacion (bool), creado_por (FK users), timestamps`.
→ `creado_por` **ya existe**; el tipo es `tipo_documental_id` (FK), **no** un campo de texto.

### Bug encontrado (a corregir en F2)
`ProvidenciaPdfService::generarFolioProvidencia()` genera el folio con un `SELECT ... ORDER BY ... DESC` **sin transacción ni lock** → folios duplicados bajo concurrencia. En cambio, `Correlativo::obtenerSiguiente()` **ya usa** `DB::transaction` + `lockForUpdate` (es el patrón correcto a reutilizar).

---

## 2. Recomendación: Opción B en 2 fases

Un **mantenedor por bloques tipados** + **renderer paramétrico** que unifica los dos motores. Se entrega en dos fases para dar valor rápido y bajo riesgo primero, y el objetivo visual después.

- **Fase 1 — Mantenedor CRUD** (bajo riesgo, ~3-4 días): administrar las plantillas (metadatos, variables, activar/desactivar/duplicar) con preview en vivo, **sin tocar el render**. Saca del seeder la gestión del día a día.
- **Fase 2 — Bloques + renderer estilo providencia** (~8-12 días): `estructura_json` + `estilo_json`, renderer Blade paramétrico clonado de la providencia (firma/pie `fixed`, folio automático), editor visual de bloques y migración incremental de las 8 plantillas con una bandera por plantilla (`render_engine`) que permite rollback.

> **Por qué bloques y no "editar HTML libre":** evita XSS y PDFs rotos en DomPDF (el render controla el markup y solo escapa los textos del usuario), y entrega control en lenguaje de negocio. Si en el futuro se necesita HTML avanzado, se habilita **solo para admin** y con saneo server-side.

---

## 3. Modelo de datos

### Fase 1 — columnas aditivas (sin tocar nada existente)
| Tabla | Columna | Tipo | Nota |
|---|---|---|---|
| `documento_plantillas` | `editable_admin` | `boolean NOT NULL DEFAULT false` | Marca las 8 plantillas base como editables desde el mantenedor |
| `documento_plantillas` | `orden` | `smallint UNSIGNED NULL` | Orden de aparición en el selector |
| `documento_plantillas` | `origen` | `enum('seeder','admin') NOT NULL DEFAULT 'seeder'` | Protege ediciones del admin de ser pisadas por el seeder |

### Fase 2 — columnas aditivas (render por bloques)
| Tabla | Columna | Tipo | Nota |
|---|---|---|---|
| `documento_plantillas` | `render_engine` | `varchar(20) NOT NULL DEFAULT 'html_legacy'` | `html_legacy` \| `bloques` — cutover/rollback por plantilla |
| `documento_plantillas` | `estructura_json` | `json NULL` | Lista ordenada de bloques (ver ejemplo) |
| `documento_plantillas` | `estilo_json` | `json NULL` | Márgenes, fuente, papel, logo, barra de colores |
| `documento_plantillas` | `version_seeder` | `unsignedInteger NULL` | Para que el seeder no pise ediciones del admin |
| `correlativos` | *(fila nueva `tipo='providencia'`)* | `INSERT` | Folio con lock; `valor_actual` sembrado con el MAX actual de `Derivacion.folio` |

> Nada destructivo: `contenido_html` y `variables_json` se mantienen intactos, por lo que `DocumentoNew`, `prefillFromDocumento` y los presets personales siguen funcionando sin cambios. Los documentos ya firmados se regeneran por el camino `html_legacy` (cero regresión).

### Ejemplo de `estructura_json` (Decreto)
```json
[
  { "tipo": "barra_colores", "props": {} },
  { "tipo": "membrete", "props": { "mostrar_logo": true } },
  { "tipo": "titulo", "props": { "texto": "DECRETO ALCALDICIO Nº {{numero}}", "align": "center" } },
  { "tipo": "ref_fecha", "props": { "items": [{ "label": "Ref:", "valor": "{{referencia}}" }], "ciudad": "Puerto Williams", "fecha_var": "fecha", "align": "right" } },
  { "tipo": "seccion_titulada", "props": { "titulo": "VISTOS Y CONSIDERANDO", "cuerpo_var": "vistos", "indent": true } },
  { "tipo": "lista_articulos", "props": { "fuente": "articulos", "prefijo": "ARTÍCULO", "ordinal": true } },
  { "tipo": "seccion_titulada", "props": { "titulo": "DECRETO", "titulo_align": "center", "cuerpo_var": "texto_decreto" } },
  { "tipo": "parrafos", "props": { "texto": "ANÓTESE, COMUNÍQUESE Y ARCHÍVESE.", "align": "center" } },
  { "tipo": "firmas", "props": { "fuente": "firmantes", "estilo": "inline", "por_fila": 3 } },
  { "tipo": "distribucion", "props": { "titulo": "DISTRIBUCIÓN", "fuente": "distribucion" } },
  { "tipo": "qr_pie", "props": { "fixed": true } }
]
```

### Ejemplo de `estilo_json`
```json
{
  "papel": "letter", "orientacion": "portrait",
  "fuente_familia": "Times New Roman, serif", "fuente_tamano": "12pt",
  "color_texto": "#1a1a1a", "line_height": 1.5,
  "margenes": { "top": "1cm", "right": "2cm", "bottom": "3.2cm", "left": "2.5cm" },
  "logo": { "mostrar": true, "max_ancho": "110px" },
  "membrete": { "mostrar": true, "institucion": "Ilustre Municipalidad de Cabo de Hornos", "subtitulo": "Puerto Williams · Provincia Antártica Chilena · Región de Magallanes", "color": "#0071BC" },
  "barra_colores": { "mostrar": true, "colores": ["#2DC700", "#8AC53E", "#EB1B78", "#28A9E3", "#EE5825"] },
  "regla_azul": true,
  "firma": { "posicion": "fixed", "bottom": "3.6cm" },
  "pie": { "qr": true, "bottom": "1.2cm" }
}
```

---

## 4. Catálogo de bloques (enum en código, un parcial Blade por bloque)

Cubre las **8 plantillas** del seeder + **providencia** + **acuse de recibo**:

| Bloque | Qué resuelve | Dato |
|---|---|---|
| `barra_colores` | Barra superior de 5 colores institucionales | constante de marca (`estilo_json`) |
| `membrete` | Logo + institución + subtítulo + regla azul | logo desde `estilo_json`; textos de plantilla |
| `titulo` | "DECRETO Nº {{numero}}", "MEMORÁNDUM Nº", "PROVIDENCIA Nº {{folio}}"… | interpola variables |
| `ref_fecha` | Ref/ANT/MAT/Asunto + ciudad y fecha (decreto, oficio, ordinario, circular, informe) | variables |
| `de_para` | Tabla DE/PARA estilo memo (memo, ordinario, providencia) | variables / contexto |
| `destinatario` | Bloque A:/cargo/institución/PRESENTE (oficio, carta) | variables |
| `seccion_titulada` | Título en mayúsculas + cuerpo (VISTOS, CONSIDERANDO, RESUELVO, secciones de informe/acta, "Documento de origen" y "Observaciones" de providencia) | variable de texto largo |
| `parrafos` | Texto libre / cierres ("Saluda atentamente", "ANÓTESE…") | variable o literal |
| `tabla_datos` | Tabla etiqueta:valor (fecha/hora/lugar de acta; recepción de providencia) | variables |
| `lista_articulos` | Artículos numerados del decreto (reemplaza `articulos_html`); también "Se solicita" de providencia | datos estructurados (`articulos` / `acciones_para`) |
| `firmas` | Firma(s): línea + nombre + RUT + cargo + leyenda de subrogancia; variante `inline` (N por fila) o `fixed` | `firmantes` + contexto |
| `distribucion` | Pie de distribución en cursiva 8pt (reemplaza `distribucion_html`) | `distribucion` |
| `qr_pie` | Pie unificado con QR + código + URL en `position:fixed` (reemplaza `inyectarFooterVerificacion` y el pie de providencia) | `codigo_verificacion`, folio, QR data-URI (server) |

> Los bloques repetibles (`lista_articulos`, `firmas`, `distribucion`) se arman **en el servidor** desde datos estructurados, eliminando la generación de HTML en el cliente (`generarArticulosHtml`/`generarFirmasHtml`/`generarDistribucionHtml` de `DocumentoNew.tsx`).

---

## 5. Backend

| Componente | Archivo | Fase |
|---|---|---|
| Migración aditiva F1 (`editable_admin`, `orden`, `origen`) | `database/migrations/..._add_metadatos_to_documento_plantillas.php` | F1 |
| `AdminPlantillaController` (index/show/store/update/toggleActivo/duplicar/destroy-bloqueado) bajo `role:admin`; `Cache::forget('plantillas_activas')` en cada escritura | `app/Http/Controllers/Admin/AdminPlantillaController.php` | F1 |
| Modelo `DocumentoPlantilla`: nuevos `$fillable`/`$casts`, hook `saved()/deleted()` → invalida cache, relación a presets | `app/Models/DocumentoPlantilla.php` | F1 |
| Rutas admin (`apiResource admin/plantillas` + `toggle-activo` + `previsualizar`) en el grupo `role:admin` existente | `routes/api.php` | F1 |
| Migración aditiva F2 (`render_engine`, `estructura_json`, `estilo_json`, `version_seeder`) | `database/migrations/..._add_bloques_to_documento_plantillas.php` | F2 |
| Enum `BloqueTipo` (catálogo, fuente de verdad; se expone al frontend por endpoint) | `app/Enums/BloqueTipo.php` | F2 |
| `PlantillaRenderer` (motor unificado: `html_legacy` = comportamiento actual; `bloques` = recorre `estructura_json` → parciales + `estilo_json`) | `app/Services/PlantillaRenderer.php` | F2 |
| Blade base paramétrico + parciales por bloque (clonado de `providencia.blade`: barra, membrete, firma/pie `fixed`, `.page-content` padding) | `resources/views/pdf/plantilla_base.blade.php` + `pdf/bloques/*.blade.php` | F2 |
| `PlantillaBloquesRequest` (valida estructura/estilo contra el catálogo; whitelist de fuente/papel/colores; saneo de texto largo) | `app/Http/Requests/PlantillaBloquesRequest.php` | F2 |
| Refactor `Documento::generarPdfFinal` (usa `PlantillaRenderer` según `render_engine`, con fallback legacy) | `app/Models/Documento.php` | F2 |
| Fix folio: `ProvidenciaPdfService::generarFolioProvidencia` → `Correlativo::obtenerSiguiente('providencia')` (atómico) + data-migration de siembra | `app/Services/ProvidenciaPdfService.php` + `app/Models/Correlativo.php` | F2 |
| Seeder idempotente (devuelve `estructura_json`/`estilo_json`; no pisa ediciones del admin vía `origen`/`version_seeder`) | `database/seeders/DocumentoPlantillaSeeder.php` | F2 |

## 6. Frontend

| Componente | Archivo | Fase |
|---|---|---|
| API admin de plantillas (CRUD + catálogo de bloques) | `src/api/adminPlantillas.ts` | F1 |
| Listado `PlantillasManage` (tabla, patrón de `UsuariosManage`/`FirmaSellosPage`, guard admin) | `src/pages/admin/PlantillasManage.tsx` | F1 |
| `PlantillaForm` (metadatos + variables + preview en vivo reusando `/documentos/previsualizar`, debounce 500ms) | `src/pages/admin/PlantillaForm.tsx` | F1 |
| Rutas `/plantillas` + entrada de menú (junto a Configuración / Firma-Sellos) | `src/App.tsx` + `src/pages/admin/Administracion.tsx` | F1 |
| Tipos TS (`render_engine`, `estructura_json`, `estilo_json`, `BloqueTipo`) sin romper `variables_json`/`contenido_html` | `src/types/index.ts` | F1/F2 |
| `BloquesEditor` (componer `estructura_json`: agregar/quitar/reordenar bloques + props por bloque) + panel de estilo | `src/pages/admin/BloquesEditor.tsx` | F2 |
| `DocumentoNew.tsx` desacoplado del armado de HTML (envía datos estructurados; orden/long-text desde la plantilla con fallback a las constantes) | `src/pages/gestor/DocumentoNew.tsx` | F2 |

---

## 7. Migración de datos

1. **F1**: migración aditiva (`editable_admin`, `orden`, `origen`). Backfill: `editable_admin=true`, `orden 1..8` a las 8 activas; las legacy desactivadas en `false`.
2. **F1**: el seeder pasa a **bootstrap idempotente** (`firstOrCreate` / no pisar metadatos editables).
3. **F2**: migración aditiva (`render_engine` default `html_legacy`, `estructura_json`/`estilo_json` null). **Cero cambio de render** hasta cambiar la bandera por plantilla.
4. **F2**: portar el seeder a bloques **una plantilla a la vez**, empezando por `PLT_DECRETO_001`; validar PDF/QR/folio y replicar.
5. **F2 (presets)**: `documento_plantillas_personales.contenido_json` conserva su shape `{variables, articulos, distribucion, firmantes_ids}`; el renderer de bloques lee esas mismas claves. **No cambiar el shape.**
6. **F2 (folio)**: data-migration que crea `correlativos` tipo `providencia` con `valor_actual = MAX(Derivacion.folio)` del año, para continuar sin colisiones.
7. **Deploy CT106**: F2 toca Blade/PDF → requiere `php artisan view:clear` + `cache:clear` (sin esto los cambios de PDF **no** se reflejan).

---

## 8. Fases y esfuerzo

| Fase | Alcance | Esfuerzo | Riesgo |
|---|---|---|---|
| **F1 — Mantenedor CRUD** | CRUD admin (metadatos + variables + preview), invalidar cache, bloquear borrado con dependencias. No toca render ni presets. | ~3-4 días | Bajo |
| **F2 — Bloques + renderer** | `estructura_json`/`estilo_json`, renderer paramétrico estilo providencia, editor de bloques, fix folio, migración incremental por bandera. | ~8-12 días | Medio |

---

## 9. Pruebas

- **F1**: editar una plantilla y verificar que `/documentos/plantillas` refleja el cambio al instante (cache invalidada); crear documento con plantilla editada (formulario + preview siguen ok); borrar plantilla con documentos/presets queda **bloqueado** (solo desactivar); acceso solo `admin` (403 para otros).
- **F2**: Decreto en `render_engine=bloques` produce PDF equivalente o mejor que el legacy; documento legacy guardado sigue regenerando idéntico (fallback); preview del editor coincide con el PDF real; firma/pie `fixed` anclados con 1 y >1 páginas; **concurrencia de folio**: N en paralelo → folios únicos (test que hoy falla con el código actual); preset antiguo renderiza bien bajo bloques.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Folio duplicado** (bug actual) | `Correlativo::obtenerSiguiente` (transacción + `lockForUpdate`) + `unique` en la columna de folio + test de concurrencia |
| **DomPDF frágil** (`@page margin` ignorado, no SVG inline, solo core fonts) | Clonar el Blade ya probado de providencia; `.page-content` padding; QR como `data:image/svg+xml;base64`; `estilo_json` con whitelist de fuente/papel |
| **Cache `plantillas_activas` (1h)** | `Cache::forget` en cada escritura del controller **y** en hook del modelo (defensa en profundidad) |
| **Presets en cascade** (`onDelete cascade`) | Borrado solo lógico (`activo=false`); nunca `DELETE` físico con presets; avisar presets afectados en la UI |
| **Seeder pisando prod** | `origen`/`version_seeder`: el seeder solo reescribe estructura/estilo si no fue editada por el admin; `updateOrCreate` idempotente |
| **Acoplamiento frontend** | F1 no toca las constantes; F2 desacopla a datos estructurados con fallback y migración por bandera |
| **Deploy CT106** | `view:clear` + `cache:clear` en el deploy de F2 (documentado) |

---

## 11. Decisiones a confirmar antes de F2

1. **Fuente de verdad del folio.** Recomendado: una secuencia `providencia` en `correlativos` (con lock) para el folio del pie, sembrada con el MAX actual; el `numero` del tipo documental sigue siendo dato del cuerpo. *(No mezcla numeraciones legales y elimina el bug.)*
2. **Documentos ya firmados.** Recomendado: **inmutables** (el PDF firmado no se re-renderiza). Bloques aplica solo a documentos nuevos/borradores.
3. **Editor de estructura.** Recomendado: reordenar con botones subir/bajar en F2; drag-and-drop como pulido posterior.
4. **Texto largo con HTML** (vistos, contenido). Recomendado: permitir HTML pero con **saneo whitelist** (p, strong, em, ul/li, br) en el renderer.
5. **Acuse de recibo.** Recomendado: portarlo también a bloques (un solo motor), como plantilla de sistema no editable libremente por su valor legal.
