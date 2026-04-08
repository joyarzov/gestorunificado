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

## Recurring UX Anti-Patterns
1. No confirmation dialogs for destructive actions (except rechazar firma uses prompt())
2. handleLimpiar uses setTimeout(loadDocumentos, 0) - race condition pattern
3. eslint-disable for react-hooks/exhaustive-deps across multiple files
4. Inconsistent error handling: some catch silently, some show alerts
5. No dirty-state warning when navigating away from forms
6. Notificaciones in Portal are not clickable/actionable (no navigation to related item)
7. PendientesFirma lacks pagination and filters (unlike DocumentosList)
8. `prompt()` used for rechazo motivo instead of a proper dialog

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
