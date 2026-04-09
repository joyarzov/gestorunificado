import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box, Typography, Button, Card, CardContent, Grid, TextField,
  FormControlLabel, Switch, Alert, CircularProgress, Divider,
  Chip,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Upload as UploadIcon,
} from '@mui/icons-material'
import { firmaSelloAPI } from '../../api/firmaSello'
import { FirmaSello } from '../../types'
import api from '../../api/axios'

const STORAGE_URL = '/storage/'

const defaults = {
  nombre: '',
  color_primario: '#0071BC',
  color_secundario: '#00467E',
  color_fondo: '#EBF5FF',
  mostrar_logo: true,
  nombre_institucion: 'Ilustre Municipalidad de Cabo de Hornos',
  texto_linea1: 'FIRMA ELECTRÓNICA AVANZADA',
  texto_linea2: 'GOBIERNO DE CHILE',
}

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
          mostrar_logo: s.mostrar_logo,
          nombre_institucion: s.nombre_institucion,
          texto_linea1: s.texto_linea1,
          texto_linea2: s.texto_linea2,
        })
        if (s.logo_path) setLogoActual(s.logo_path)
      })
      .catch(() => setError('Error al cargar el diseño'))
      .finally(() => setLoading(false))
  }, [id, esEdicion])

  // Preview con debounce
  const actualizarPreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params: Record<string, string | boolean> = {
        color_primario:     form.color_primario,
        color_secundario:   form.color_secundario,
        color_fondo:        form.color_fondo,
        mostrar_logo:       form.mostrar_logo,
        nombre_institucion: form.nombre_institucion,
        texto_linea1:       form.texto_linea1,
        texto_linea2:       form.texto_linea2,
      }
      if (logoActual && !logoNuevo) params.logo_path = logoActual
      const url = firmaSelloAPI.previewUrl(params)
      setPreviewUrl(url)
      setPreviewKey(k => k + 1)
    }, 600)
  }, [form, logoActual, logoNuevo])

  useEffect(() => { actualizarPreview() }, [actualizarPreview])

  const handleChange = (field: string, value: string | boolean) => {
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
      if (esEdicion) {
        const res = await firmaSelloAPI.actualizar(parseInt(id!), form)
        sello = res.data
      } else {
        const res = await firmaSelloAPI.crear(form)
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

              <Alert severity="info" sx={{ mt: 1 }}>
                Guardar no activa el diseño. Actívalo desde el listado cuando estés listo.
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Preview */}
        <Grid item xs={12} md={6}>
          <Card sx={{ position: 'sticky', top: 88 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="h6">Vista previa</Typography>
                <Chip label="Datos de ejemplo" size="small" variant="outlined" />
              </Box>
              {previewUrl ? (
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
                  }}
                  onError={() => setPreviewUrl(null)}
                />
              ) : (
                <Box sx={{
                  width: '100%', height: 140, bgcolor: '#f5f5f5',
                  borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                La preview se actualiza automáticamente al cambiar los campos (datos de ejemplo: Juan Pérez González / Alcalde).
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default FirmaSelloForm
