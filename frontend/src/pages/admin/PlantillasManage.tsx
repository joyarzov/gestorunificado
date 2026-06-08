import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  Snackbar,
  FormControlLabel,
  Checkbox,
  Tooltip,
  Button,
  Divider,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import {
  Edit as EditIcon,
  ContentCopy as DuplicarIcon,
  Visibility as PreviewIcon,
  Block as DesactivarIcon,
  CheckCircle as ActivarIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material'
import { adminPlantillasAPI } from '../../api/adminPlantillas'
import { documentosAPI, tiposDocumentalesAPI } from '../../api/gestor'
import { DocumentoPlantilla, TipoDocumental } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const msgError = (err: any, fallback: string) =>
  err?.response?.data?.message || fallback

interface VariableRow {
  clave: string
  descripcion: string
}

// Tamaños de papel en cm (carta = US letter; oficio = formato chileno 21,6 × 33)
const PAPELES = {
  carta: { w: 21.59, h: 27.94, label: 'Carta' },
  oficio: { w: 21.6, h: 33.0, label: 'Oficio' },
} as const
type PapelKey = keyof typeof PAPELES

/**
 * Envuelve el HTML del documento en una hoja con el tamaño/márgenes reales del
 * PDF (los mismos de Documento::generarPdfFinal) y la escala para caber en el
 * panel, de modo que la vista previa sea proporcional a la impresión.
 */
const buildPreviewDoc = (html: string, papel: PapelKey): string => {
  const p = PAPELES[papel]
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:#eceff1;}
    #wrap{padding:14px;text-align:center;}
    /* inline-block conserva el ancho fijo de la hoja (no se encoge como flex) */
    #sheet{
      display:inline-block;text-align:left;vertical-align:top;
      width:${p.w}cm;min-height:${p.h}cm;background:#fff;box-sizing:border-box;
      padding:1.2cm 2cm 1.5cm 2.5cm;
      box-shadow:0 1px 12px rgba(0,0,0,.22);
      font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#1a1a1a;
    }
    #sheet > div{max-width:100% !important;padding:0 !important;margin:0 !important;}
    img{max-width:100%;height:auto;}
  </style></head><body>
    <div id="wrap"><div id="sheet">${html}</div></div>
    <script>
      function fit(){
        var s=document.getElementById('sheet');if(!s)return;
        s.style.zoom=1;
        var avail=document.documentElement.clientWidth-28;
        var w=s.offsetWidth;
        if(w>avail){ s.style.zoom=avail/w; }
      }
      ['load','resize'].forEach(function(e){window.addEventListener(e,fit);});
      document.addEventListener('DOMContentLoaded',fit);
      setTimeout(fit,60);setTimeout(fit,300);fit();
    </script>
  </body></html>`
}

const PlantillasManage = () => {
  const [plantillas, setPlantillas] = useState<DocumentoPlantilla[]>([])
  const [tipos, setTipos] = useState<TipoDocumental[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Edición
  const [editing, setEditing] = useState<DocumentoPlantilla | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    tipo_documental_id: '' as string,
    orden: '' as string,
    requiere_firma: false,
    requiere_aprobacion: false,
  })
  const [variables, setVariables] = useState<VariableRow[]>([])

  // Vista previa
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [papel, setPapel] = useState<PapelKey>('carta')

  // Confirmación de borrado
  const [toDelete, setToDelete] = useState<DocumentoPlantilla | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [plRes, tiposRes] = await Promise.all([
        adminPlantillasAPI.listar(),
        tiposDocumentalesAPI.listar(),
      ])
      setPlantillas(plRes.data)
      setTipos(tiposRes.data)
      setError('')
    } catch (err) {
      setError(msgError(err, 'Error al cargar las plantillas'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const cargarPreview = useCallback(async (plantilla: DocumentoPlantilla, vars: VariableRow[]) => {
    setPreviewLoading(true)
    try {
      const sample: Record<string, string> = {}
      vars.forEach((v) => {
        sample[v.clave] = v.descripcion || v.clave
      })
      const res = await documentosAPI.previsualizar({
        plantilla_id: plantilla.id,
        contenido_json: sample,
      })
      setPreviewHtml(res.html)
    } catch {
      setPreviewHtml('<p style="color:#999;font-family:sans-serif">No se pudo generar la vista previa.</p>')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  const handleEdit = (p: DocumentoPlantilla) => {
    setEditing(p)
    setForm({
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      tipo_documental_id: p.tipo_documental_id ? String(p.tipo_documental_id) : '',
      orden: p.orden != null ? String(p.orden) : '',
      requiere_firma: !!p.requiere_firma,
      requiere_aprobacion: !!p.requiere_aprobacion,
    })
    const vars: VariableRow[] = Object.entries(p.variables_json || {}).map(([clave, descripcion]) => ({
      clave,
      descripcion: String(descripcion ?? ''),
    }))
    setVariables(vars)
    setPreviewHtml('')
    cargarPreview(p, vars)
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const variables_json: Record<string, string> = {}
      variables.forEach((v) => {
        if (v.clave.trim()) variables_json[v.clave.trim()] = v.descripcion
      })
      const res = await adminPlantillasAPI.actualizar(editing.id, {
        nombre: form.nombre,
        descripcion: form.descripcion,
        tipo_documental_id: form.tipo_documental_id ? Number(form.tipo_documental_id) : undefined,
        orden: form.orden ? Number(form.orden) : undefined,
        requiere_firma: form.requiere_firma,
        requiere_aprobacion: form.requiere_aprobacion,
        variables_json,
      })
      setToast(res.message || 'Plantilla actualizada')
      setEditing(null)
      loadData()
    } catch (err) {
      setError(msgError(err, 'No se pudo guardar la plantilla'))
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicar = async (p: DocumentoPlantilla) => {
    try {
      const res = await adminPlantillasAPI.duplicar(p.id)
      setToast(res.message || 'Plantilla duplicada')
      loadData()
    } catch (err) {
      setError(msgError(err, 'No se pudo duplicar la plantilla'))
    }
  }

  const handleToggle = async (p: DocumentoPlantilla) => {
    try {
      const res = await adminPlantillasAPI.toggleActivo(p.id)
      setToast(res.message || 'Estado actualizado')
      loadData()
    } catch (err) {
      setError(msgError(err, 'No se pudo cambiar el estado'))
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    try {
      const res = await adminPlantillasAPI.eliminar(toDelete.id)
      setToast(res.message || 'Plantilla eliminada')
      setToDelete(null)
      loadData()
    } catch (err) {
      setError(msgError(err, 'No se pudo eliminar la plantilla'))
      setToDelete(null)
    }
  }

  const setVar = (idx: number, descripcion: string) => {
    setVariables((prev) => prev.map((v, i) => (i === idx ? { ...v, descripcion } : v)))
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Plantillas de Documentos
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Administra las plantillas del módulo «cero papel»: nombre, tipo, variables, orden y disponibilidad.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Código</TableCell>
                <TableCell>Tipo documental</TableCell>
                <TableCell align="center">Estado</TableCell>
                <TableCell align="center">Origen</TableCell>
                <TableCell align="center">Uso</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plantillas.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{p.nombre}</Typography>
                    {p.descripcion && (
                      <Typography variant="caption" color="text.secondary">{p.descripcion}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace">{p.codigo}</Typography>
                  </TableCell>
                  <TableCell>{p.tipo_documental?.nombre || '—'}</TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={p.activo ? 'Activa' : 'Inactiva'}
                      color={p.activo ? 'success' : 'default'}
                      variant={p.activo ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={p.origen === 'admin' ? 'Personalizada' : 'Sistema'}
                      color={p.origen === 'admin' ? 'info' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={`${p.documentos_count ?? 0} documento(s) · ${p.plantillas_personales_count ?? 0} preset(s)`}>
                      <Typography variant="caption" color="text.secondary">
                        {(p.documentos_count ?? 0)} doc · {(p.plantillas_personales_count ?? 0)} preset
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" color="primary" onClick={() => handleEdit(p)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicar">
                      <IconButton size="small" onClick={() => handleDuplicar(p)}>
                        <DuplicarIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={p.activo ? 'Desactivar' : 'Activar'}>
                      <IconButton size="small" color={p.activo ? 'warning' : 'success'} onClick={() => handleToggle(p)}>
                        {p.activo ? <DesactivarIcon fontSize="small" /> : <ActivarIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={p.origen === 'admin' ? 'Eliminar' : 'Las plantillas del sistema solo se desactivan'}>
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={p.origen !== 'admin'}
                          onClick={() => setToDelete(p)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Diálogo de edición */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Editar plantilla
          {editing && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ({editing.codigo})
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            {/* Formulario */}
            <Grid item xs={12} md={6}>
              <TextField
                label="Nombre"
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
              <TextField
                label="Descripción"
                fullWidth
                size="small"
                multiline
                minRows={2}
                sx={{ mb: 2 }}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid item xs={8}>
                  <TextField
                    select
                    label="Tipo documental"
                    fullWidth
                    size="small"
                    value={form.tipo_documental_id}
                    onChange={(e) => setForm({ ...form, tipo_documental_id: e.target.value })}
                  >
                    <MenuItem value="">— Sin tipo —</MenuItem>
                    {tipos.map((t) => (
                      <MenuItem key={t.id} value={String(t.id)}>{t.nombre}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    label="Orden"
                    type="number"
                    fullWidth
                    size="small"
                    value={form.orden}
                    onChange={(e) => setForm({ ...form, orden: e.target.value })}
                  />
                </Grid>
              </Grid>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.requiere_firma}
                    onChange={(e) => setForm({ ...form, requiere_firma: e.target.checked })}
                  />
                }
                label="Requiere firma"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.requiere_aprobacion}
                    onChange={(e) => setForm({ ...form, requiere_aprobacion: e.target.checked })}
                  />
                }
                label="Requiere aprobación"
              />

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Variables del formulario
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                La clave corresponde al marcador {'{{clave}}'} en el documento. Aquí editas la etiqueta de ayuda
                que verá el funcionario. La edición del contenido y el diseño llega en la Fase 2.
              </Typography>
              {variables.length === 0 && (
                <Typography variant="caption" color="text.secondary">Esta plantilla no declara variables.</Typography>
              )}
              {variables.map((v, idx) => (
                <Grid container spacing={1} key={v.clave} sx={{ mb: 1 }}>
                  <Grid item xs={4}>
                    <TextField
                      value={v.clave}
                      size="small"
                      fullWidth
                      disabled
                      InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }}
                    />
                  </Grid>
                  <Grid item xs={8}>
                    <TextField
                      value={v.descripcion}
                      size="small"
                      fullWidth
                      placeholder="Etiqueta / ayuda"
                      onChange={(e) => setVar(idx, e.target.value)}
                    />
                  </Grid>
                </Grid>
              ))}
            </Grid>

            {/* Vista previa */}
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2">Vista previa</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={papel}
                    onChange={(_, v) => v && setPapel(v)}
                  >
                    <ToggleButton value="carta" sx={{ px: 1.5, py: 0.25 }}>Carta</ToggleButton>
                    <ToggleButton value="oficio" sx={{ px: 1.5, py: 0.25 }}>Oficio</ToggleButton>
                  </ToggleButtonGroup>
                  <Button
                    size="small"
                    startIcon={<PreviewIcon />}
                    onClick={() => editing && cargarPreview(editing, variables)}
                    disabled={previewLoading}
                  >
                    Actualizar
                  </Button>
                </Box>
              </Box>
              <Paper variant="outlined" sx={{ height: 560, overflow: 'hidden', position: 'relative', bgcolor: '#eceff1' }}>
                {previewLoading && (
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.6)', zIndex: 1 }}>
                    <CircularProgress size={28} />
                  </Box>
                )}
                <iframe
                  title="preview"
                  srcDoc={previewHtml ? buildPreviewDoc(previewHtml, papel) : ''}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </Paper>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Tamaño y márgenes reales de impresión. El PDF actual se genera en Carta; el tamaño por plantilla será configurable en la Fase 2.
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmación de borrado */}
      <Dialog open={!!toDelete} onClose={() => setToDelete(null)}>
        <DialogTitle>Eliminar plantilla</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar la plantilla «{toDelete?.nombre}»? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Eliminar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}

export default PlantillasManage
