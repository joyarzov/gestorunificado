# Municipal UX Flow Auditor - Memory

## Project Structure
- Frontend pages: `frontend/src/pages/` (gestor/, oirs/, admin/, auth/, verificacion/)
- Layout: `frontend/src/components/layout/AppLayout.tsx`
- Auth: `frontend/src/contexts/AuthContext.tsx`
- Types: `frontend/src/types/index.ts`
- API: `frontend/src/api/` (gestor.ts, common.ts, auth.ts, oirs.ts, verificacion.ts)
- Theme: `frontend/src/theme.ts`

## Key UX Patterns Found
- Card-grid dashboard pattern used in Portal, GestorDashboard, Administracion (consistent)
- Stepper pattern for multi-step forms (DocumentoNew, OirsPublicForm)
- Table+filter pattern for lists (DocumentosList, RepositorioDocumental, PendientesFirma)
- Document preview uses scale transform for responsive A4 rendering
- Rich text editor for memos uses contentEditable (fragile, not a proper editor lib)

## Architectural Facts (stable, verified)
- Routes in App.tsx are only behind `PrivateRoute` (auth), NO per-role route guard. Menu visibility (config/modules.ts getSidebarItems) hides items per role, but a user can type a URL (/usuarios, /ingresar, /salidas) and the page renders; only the BACKEND enforces role (role:admin middleware in routes/api.php). Exception gap: `CorrespondenciaController::store()` has NO role check (only validate) while update/destroy/archivar do.
- gestor_documental sidebar (config/modules.ts:184-208) returns IDENTICAL items for ALL roles (no differentiation) — plain "usuario" sees Repositorio documental/expedientes, Bandeja de expedientes, Pendientes de firma same as alcalde. Repositorio pages have no role gating.
- Estado label/color catalog is UNIFIED only for correspondencia (utils/estadoCorrespondencia.ts). It is NOT used by: Bandeja (inline derivacion labels), RegistroCorrespondencia (own maps, divergent). Fragmented/duplicated everywhere else: OIRS (estadoColors + estado.replace('_',' ') per page), DocumentoEnvio (DocumentosRecibidos "Pendiente" vs DocumentoDetail "Enviado" for same `enviado`), gestor estadoLabels duplicated in 4+ files.
- Expediente real estados: borrador/en_tramite/cerrado/archivado (Expediente.php). There is NO 'abierto' state, but DocumentoNew.tsx:303 filters expedientesAPI.listar({estado:'abierto'}) → Autocomplete always empty → blocks doc creation from Dashboard/DocumentosList "Nuevo documento" (only ?expediente_id flow works). scopeAbiertos() exists but index() uses literal where.

## Recurring UX Anti-Patterns
1. No confirmation dialogs for destructive actions (except rechazar firma uses prompt())
2. handleLimpiar uses setTimeout(loadDocumentos, 0) - race condition pattern
3. eslint-disable for react-hooks/exhaustive-deps across multiple files
4. Inconsistent error handling: some catch silently, some show alerts
5. No dirty-state warning when navigating away from forms
6. Notificaciones in Portal are not clickable/actionable (no navigation to related item)
7. PendientesFirma lacks pagination and filters (unlike DocumentosList)
8. `prompt()` used for rechazo motivo instead of a proper dialog

## Correspondencia módulo (entrada) — flujo real verificado jul-2026
- Ingreso y derivación son DOS pasos separados: Create.tsx guarda y navega a Detail (Create.tsx:178); recién ahí Partes ve "Derivar a Alcalde" (Detail.tsx:611). Derivar-a-alcalde NO pide firma (readOnly, no esModoFuncionario). Oportunidad: "Guardar y derivar" en un paso. No hay panel/alerta para Partes de ingresos pendientes sin derivar (quedan en limbo invisibles).
- Alcalde en `derivada_alcaldia` ve DOS botones primarios simultáneos: "Marcar como Recibida" (recibir()) y "Derivar a Funcionario" (Detail.tsx:621-642). AMBOS firman con FirmaGob (OTP). TRAMPA: "Marcar como Recibida" acusa la deriv del alcalde → correspondencia pasa a 'completada' SIN derivar a nadie, y el botón "Derivar a Funcionario" desaparece (solo se muestra en derivada_alcaldia). Un acuse accidental cierra a "En gestión" y bloquea la derivación.
- panelAlcalde "atrasos" (CorrespondenciaController.php:478) SOLO cuenta derivaciones a funcionario sin acuse ≥3d. NO flaggea: (a) pendiente sin derivar por Partes, (b) derivada_alcaldia sin acuse del alcalde. "En tu despacho" en requiere_atencion no tiene aging.
- Bug texto Create.tsx:260 dice "máx. 10 MB c/u" pero MAX_FILE_SIZE=30MB (real). Detail "Preparar respuesta" (Detail.tsx:928) dice "Cero Papel aún no está integrado" pero el dialog de subir respuesta SÍ tiene pestaña "Documento Cero Papel" que asocia firmados — mensajes contradictorios.
- Bandeja.tsx:199 rotula estados con labels inline de la DERIVACION (pendiente→"Por recibir", recibido→"Recibida", derivado→"Derivada a Funcionario"), NO usa el catálogo único estadoCorrespondencia (que opera sobre correspondencia.estado). Mismo ítem puede verse distinto en Bandeja vs List/Detail. Tab "Activas" muestra counts.pendientes (label≠campo).

## Municipal Workflow Conventions
- Document lifecycle: borrador -> pendiente_firma -> firmado -> (enviado)
- Roles: admin, oficial, oirs, alcalde, usuario
- OIRS lifecycle: recibido -> asignada -> en_analisis -> respondido -> cerrado
- Decretos have articulos, vistos, texto_decreto; memos have de/para/contenido
- Distribution is to departments (Autocomplete multi-select)
- Verification uses codigo_verificacion (public, no auth required)

## Component Decomposition Opportunities
- DocumentoNew.tsx (1155 lines) - needs splitting into step components
- DocumentoDetail.tsx (800 lines) - could extract FirmasPanel, TrazabilidadPanel, EnvioPanel
- Preview rendering logic duplicated between DocumentoNew and DocumentoDetail

## Accessibility Gaps
- No skip-to-content link
- Some icon-only buttons lack aria-label (refresh, filter icons)
- Stepper steps in DocumentoNew clickable but no keyboard focus management
- Color-only status indicators (Chips) need text labels (they have them, good)
