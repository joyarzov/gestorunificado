import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Typography, Button, Card, CardContent, Grid, TextField,
  FormControlLabel, Switch, Alert, CircularProgress, Divider,
  Slider, MenuItem, ToggleButtonGroup, ToggleButton,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Upload as UploadIcon,
} from '@mui/icons-material'
import { firmaSelloAPI } from '../../api/firmaSello'
import { FirmaSello } from '../../types'

const STORAGE_URL = '/storage/'

const defaults = {
  nombre: '',
  color_primario: '#0071BC',
  color_secundario: '#00467E',
  color_fondo: '#EBF5FF',
  fondo_opacidad: 100,
  mostrar_logo: true,
  nombre_institucion: 'Ilustre Municipalidad de Cabo de Hornos',
  texto_linea1: 'FIRMA ELECTRÓNICA AVANZADA',
  texto_linea2: 'GOBIERNO DE CHILE',
  texto_linea3: '',
  mostrar_cargo: true,
  mostrar_rut: true,
  mostrar_fecha: true,
  formato_fecha: 'fecha_hora',
  layout: 'horizontal',
  borde_estilo: 'solido',
  borde_redondeado: false,
  tamano_fuente: 'M',
  rol_asignado: '',
}

const LAYOUTS = [
  { value: 'horizontal', label: 'Logo a la izquierda' },
  { value: 'vertical', label: 'Logo arriba (vertical)' },
  { value: 'solo_texto', label: 'Solo texto' },
  { value: 'compacto', label: 'Compacto' },
]

const BORDES = [
  { value: 'solido', label: 'Sólido' },
  { value: 'doble', label: 'Doble' },
  { value: 'sin_borde', label: 'Sin borde' },
]

const FORMATOS_FECHA = [
  { value: 'fecha_hora', label: '11/06/2026 09:45' },
  { value: 'fecha', label: '11/06/2026' },
  { value: 'larga', label: 'Puerto Williams, 11 de junio de 2026' },
]

const ROLES_SELLO = [
  { value: '', label: 'General (todos los firmantes)' },
  { value: 'alcalde', label: 'Alcalde' },
  { value: 'oficial', label: 'Oficial de Partes' },
  { value: 'admin', label: 'Administrador' },
]

const FirmaSelloForm = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const esEdicion = !!id

  const [form, setForm] = useState(defaults)
  const [logoActual, setLogoActual] = useState<string | null>(null)
  const [logoNuevo, setLogoNuevo] = useState<File | null>(null)
  const [logoPreviewLocal, setLogoPreviewLocal] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0)
  const [loading, setLoading] = useState(esEdicion)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [esActivo, setEsActivo] = useState(false)
  const [misDatos, setMisDatos] = useState(true)
  const [sobrePagina, setSobrePagina] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cargar datos si es edición
  useEffect(() => {
    if (!esEdicion) return
    firmaSelloAPI.obtener(parseInt(id!))
      .then(res => {
        const s = res.data
        setForm({
          nombre: s.nombre,
          color_primario: s.color_primario,
          color_secundario: s.color_secundario,
          color_fondo: s.color_fondo,
          fondo_opacidad: s.fondo_opacidad ?? 100,
          mostrar_logo: s.mostrar_logo,
          nombre_institucion: s.nombre_institucion,
          texto_linea1: s.texto_linea1,
          texto_linea2: s.texto_linea2,
          texto_linea3: s.texto_linea3 ?? '',
          mostrar_cargo: s.mostrar_cargo ?? true,
          mostrar_rut: s.mostrar_rut ?? true,
          mostrar_fecha: s.mostrar_fecha ?? true,
          formato_fecha: s.formato_fecha ?? 'fecha_hora',
          layout: s.layout ?? 'horizontal',
          borde_estilo: s.borde_estilo ?? 'solido',
          borde_redondeado: s.borde_redondeado ?? false,
          tamano_fuente: s.tamano_fuente ?? 'M',
          rol_asignado: s.rol_asignado ?? '',
        })
        if (s.logo_path) setLogoActual(s.logo_path)
        setEsActivo(s.activo)
      })
      .catch(() => setError('Error al cargar el diseño'))
      .finally(() => setLoading(false))
  }, [id, esEdicion])

  // Preview con debounce — fetch via Axios (incluye token auth) → blob URL
  const actualizarPreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const params: Record<string, string | boolean | number> = {
          color_primario:     form.color_primario,
          color_secundario:   form.color_secundario,
          color_fondo:        form.color_fondo,
          fondo_opacidad:     form.fondo_opacidad,
          mostrar_logo:       form.mostrar_logo,
          nombre_institucion: form.nombre_institucion,
          texto_linea1:       form.texto_linea1,
          texto_linea2:       form.texto_linea2,
          texto_linea3:       form.texto_linea3,
          mostrar_cargo:      form.mostrar_cargo,
          mostrar_rut:        form.mostrar_rut,
          mostrar_fecha:      form.mostrar_fecha,
          formato_fecha:      form.formato_fecha,
          layout:             form.layout,
          borde_estilo:       form.borde_estilo,
          borde_redondeado:   form.borde_redondeado,
          tamano_fuente:      form.tamano_fuente,
          mis_datos:          misDatos,
        }
        if (logoActual && !logoNuevo) params.logo_path = logoActual
        const blob = await firmaSelloAPI.preview(params, logoNuevo)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url })
        setPreviewKey(k => k + 1)
      } catch {
        // preview no crítico
      }
    }, 600)
  }, [form, logoActual, logoNuevo, misDatos])

  useEffect(() => { actualizarPreview() }, [actualizarPreview])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [])

  const handleChange = (field: string, value: string | boolean | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoNuevo(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreviewLocal(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError(null)
    try {
      let sello: FirmaSello
      const payload = { ...form, rol_asignado: form.rol_asignado || null } as Partial<FirmaSello>
      if (esEdicion) {
        const res = await firmaSelloAPI.actualizar(parseInt(id!), payload)
        sello = res.data
      } else {
        const res = await firmaSelloAPI.crear(payload)
        sello = res.data
      }
      // Subir logo si hay uno nuevo
      if (logoNuevo) {
        await firmaSelloAPI.subirLogo(sello.id, logoNuevo)
      }
      navigate('/firma-sellos', {
        state: { mensaje: esEdicion ? 'Diseño actualizado.' : 'Diseño guardado. Actívalo desde el listado para usarlo en nuevas firmas.' }
      })
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/firma-sellos')}>Volver</Button>
        <Typography variant="h4" fontWeight="bold">
          {esEdicion ? 'Editar diseño' : 'Nuevo diseño de sello'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Formulario */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Nombre del diseño"
                value={form.nombre}
                onChange={e => handleChange('nombre', e.target.value)}
                placeholder="Ej: Sello Oficial 2026"
                fullWidth
                required
              />

              <Divider>Textos</Divider>

              <TextField
                label="Nombre de la institución"
                value={form.nombre_institucion}
                onChange={e => handleChange('nombre_institucion', e.target.value)}
                fullWidth
              />
              <TextField
                label="Línea 1 (título del sello)"
                value={form.texto_linea1}
                onChange={e => handleChange('texto_linea1', e.target.value)}
                fullWidth
              />
              <TextField
                label="Línea 2 (subtítulo)"
                value={form.texto_linea2}
                onChange={e => handleChange('texto_linea2', e.target.value)}
                fullWidth
              />
              <TextField
                label="Línea 3 (opcional)"
                value={form.texto_linea3}
                onChange={e => handleChange('texto_linea3', e.target.value)}
                placeholder="Ej: Región de Magallanes y Antártica Chilena"
                fullWidth
              />

              <Divider>Datos del firmante</Divider>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={<Switch size="small" checked={form.mostrar_cargo} onChange={e => handleChange('mostrar_cargo', e.target.checked)} />}
                  label="Cargo"
                />
                <FormControlLabel
                  control={<Switch size="small" checked={form.mostrar_rut} onChange={e => handleChange('mostrar_rut', e.target.checked)} />}
                  label="RUT"
                />
                <FormControlLabel
                  control={<Switch size="small" checked={form.mostrar_fecha} onChange={e => handleChange('mostrar_fecha', e.target.checked)} />}
                  label="Fecha"
                />
              </Box>
              {form.mostrar_fecha && (
                <TextField
                  select
                  label="Formato de la fecha"
                  value={form.formato_fecha}
                  onChange={e => handleChange('formato_fecha', e.target.value)}
                  fullWidth
                  size="small"
                >
                  {FORMATOS_FECHA.map(f => (
                    <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                  ))}
                </TextField>
              )}

              <Divider>Diseño</Divider>

              <TextField
                select
                label="Disposición (layout)"
                value={form.layout}
                onChange={e => handleChange('layout', e.target.value)}
                fullWidth
                size="small"
              >
                {LAYOUTS.map(l => (
                  <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>
                ))}
              </TextField>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                  select
                  label="Borde"
                  value={form.borde_estilo}
                  onChange={e => handleChange('borde_estilo', e.target.value)}
                  size="small"
                  sx={{ minWidth: 140 }}
                >
                  {BORDES.map(b => (
                    <MenuItem key={b.value} value={b.value}>{b.label}</MenuItem>
                  ))}
                </TextField>
                {form.borde_estilo !== 'sin_borde' && (
                  <FormControlLabel
                    control={<Switch size="small" checked={form.borde_redondeado} onChange={e => handleChange('borde_redondeado', e.target.checked)} />}
                    label="Esquinas redondeadas"
                  />
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">Tamaño de letra</Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={form.tamano_fuente}
                    onChange={(_, v) => v && handleChange('tamano_fuente', v)}
                  >
                    <ToggleButton value="S" sx={{ px: 1.5 }}>S</ToggleButton>
                    <ToggleButton value="M" sx={{ px: 1.5 }}>M</ToggleButton>
                    <ToggleButton value="L" sx={{ px: 1.5 }}>L</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Box>

              <Divider>Asignación</Divider>

              <TextField
                select
                label="Usar este sello para"
                value={form.rol_asignado}
                onChange={e => handleChange('rol_asignado', e.target.value)}
                fullWidth
                size="small"
                helperText="Con un rol asignado, los firmantes de ese rol usarán este sello (si está activo) en vez del general."
              >
                {ROLES_SELLO.map(r => (
                  <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                ))}
              </TextField>

              <Divider>Colores</Divider>

              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Color primario
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      component="input"
                      type="color"
                      value={form.color_primario}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('color_primario', e.target.value)}
                      sx={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 1, p: 0 }}
                    />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{form.color_primario}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Color secundario
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      component="input"
                      type="color"
                      value={form.color_secundario}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('color_secundario', e.target.value)}
                      sx={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 1, p: 0 }}
                    />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{form.color_secundario}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Color de fondo
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      component="input"
                      type="color"
                      value={form.color_fondo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('color_fondo', e.target.value)}
                      sx={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 1, p: 0 }}
                    />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{form.color_fondo}</Typography>
                  </Box>
                </Grid>
              </Grid>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Opacidad del fondo: <strong>{form.fondo_opacidad}%</strong>
                  {form.fondo_opacidad === 0
                    ? ' · transparente'
                    : form.fondo_opacidad === 100
                    ? ' · sólido'
                    : ' · translúcido'}
                </Typography>
                <Box sx={{ px: 1 }}>
                  <Slider
                    value={form.fondo_opacidad}
                    onChange={(_, v) => handleChange('fondo_opacidad', v as number)}
                    min={0}
                    max={100}
                    step={5}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 100, label: '100%' },
                    ]}
                    size="small"
                    sx={{ '& .MuiSlider-markLabel': { fontSize: 10 } }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  0% = transparente (se ve el documento detrás) · 100% = sólido. Recomendado 100% u 85–95% para un tinte sutil.
                </Typography>
              </Box>

              <Divider>Logo institucional</Divider>

              <FormControlLabel
                control={
                  <Switch
                    checked={form.mostrar_logo}
                    onChange={e => handleChange('mostrar_logo', e.target.checked)}
                    color="primary"
                  />
                }
                label="Mostrar logo en el sello"
              />

              {form.mostrar_logo && (
                <Box>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    style={{ display: 'none' }}
                    onChange={handleLogoSelect}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    size="small"
                  >
                    {logoNuevo ? logoNuevo.name : logoActual ? 'Cambiar logo' : 'Subir logo (PNG/JPG)'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Recomendado: PNG con fondo transparente, mínimo 100×100px
                  </Typography>
                  {(logoPreviewLocal || logoActual) && (
                    <Box
                      component="img"
                      src={logoPreviewLocal || (STORAGE_URL + logoActual)}
                      alt="Logo"
                      sx={{ mt: 1, height: 60, width: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 0.5 }}
                    />
                  )}
                </Box>
              )}

              <Divider />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button onClick={() => navigate('/firma-sellos')}>Cancelar</Button>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                  onClick={handleGuardar}
                  disabled={saving}
                >
                  Guardar diseño
                </Button>
              </Box>

              <Alert severity={esActivo ? 'warning' : 'info'} sx={{ mt: 1 }}>
                {esActivo
                  ? 'Estás editando el sello ACTIVO: los cambios se aplican a las firmas nuevas (las ya firmadas no se modifican).'
                  : 'Guardar no activa el diseño. Actívalo desde el listado cuando estés listo.'}
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Preview */}
        <Grid item xs={12} md={6}>
          <Card sx={{ position: 'sticky', top: 88 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ flex: 1 }}>Vista previa</Typography>
                <FormControlLabel
                  control={<Switch size="small" checked={misDatos} onChange={e => setMisDatos(e.target.checked)} />}
                  label={<Typography variant="caption">Mis datos</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" checked={sobrePagina} onChange={e => setSobrePagina(e.target.checked)} />}
                  label={<Typography variant="caption">Sobre página</Typography>}
                />
              </Box>
              {previewUrl ? (
                sobrePagina ? (
                  /* Montado sobre una página de muestra, a escala real
                     (el sello ocupa ~160pt de los 612pt de ancho de la hoja) */
                  <Box sx={{
                    width: '100%', maxWidth: 460, aspectRatio: '8.5 / 11',
                    bgcolor: '#fff', border: '1px solid #ddd', borderRadius: 1,
                    position: 'relative', overflow: 'hidden', mx: 'auto',
                  }}>
                    <Box sx={{ p: '7% 9%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {[78, 60, 72, 55, 68, 48, 74, 52, 66, 58, 70, 44, 62, 50].map((w, i) => (
                        <Box key={i} sx={{ height: 3, bgcolor: 'grey.200', borderRadius: 1, width: `${w}%` }} />
                      ))}
                    </Box>
                    <Box
                      key={previewKey}
                      component="img"
                      src={previewUrl}
                      alt="Sello sobre página"
                      sx={{ position: 'absolute', left: '11%', bottom: '8%', width: '27%', height: 'auto' }}
                    />
                  </Box>
                ) : (
                  <Box
                    key={previewKey}
                    component="img"
                    src={previewUrl}
                    alt="Preview sello"
                    sx={{
                      width: '100%',
                      maxWidth: 520,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      display: 'block',
                      backgroundImage: 'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%)',
                      backgroundSize: '16px 16px',
                    }}
                    onError={() => setPreviewUrl(null)}
                  />
                )
              ) : (
                <Box sx={{
                  width: '100%', height: 140, bgcolor: '#f5f5f5',
                  borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Se actualiza al cambiar cualquier campo. "Mis datos" usa tu nombre/cargo/RUT reales;
                "Sobre página" muestra el sello a escala sobre una hoja carta. El damero indica las zonas transparentes.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default FirmaSelloForm
