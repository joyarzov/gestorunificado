import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Grid,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  Send as SendIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  CheckCircle as SuccessIcon,
  Home as HomeIcon,
} from '@mui/icons-material'
import { fondosPublicoAPI } from '../../api/fondos'
import { FondoConcursable, PostulacionItemFinanciamiento, PostulacionAdjunto } from '../../types'
import FinanciamientoTable from '../../components/fondos/FinanciamientoTable'

const steps = [
  'Datos del Emprendedor',
  'Datos del Emprendimiento',
  'Plan de Negocio',
  'Plan de Financiamiento',
  'Documentos Adjuntos',
]

const TIPOS_ADJUNTO = [
  { value: 'cedula_identidad', label: 'Cédula de Identidad' },
  { value: 'registro_social_hogares', label: 'Registro Social de Hogares' },
  { value: 'cotizaciones', label: 'Cotizaciones' },
  { value: 'resolucion_sanitaria', label: 'Resolución Sanitaria' },
  { value: 'patente_comercial', label: 'Patente Comercial' },
  { value: 'carpeta_tributaria', label: 'Carpeta Tributaria' },
  { value: 'otro', label: 'Otro' },
]

const PostulacionForm = () => {
  const navigate = useNavigate()
  const { codigo: codigoParam } = useParams<{ codigo?: string }>()

  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [codigoFinal, setCodigoFinal] = useState<string | null>(null)

  const [fondo, setFondo] = useState<FondoConcursable | null>(null)
  const [codigo, setCodigo] = useState<string | null>(codigoParam || null)

  // Datos del formulario
  const [datos, setDatos] = useState<Record<string, unknown>>({})
  const [itemsFinanciamiento, setItemsFinanciamiento] = useState<Partial<PostulacionItemFinanciamiento>[]>([])
  const [adjuntos, setAdjuntos] = useState<PostulacionAdjunto[]>([])

  // Datos planos
  const [nombre, setNombre] = useState('')
  const [rut, setRut] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')

  // Upload state
  const [tipoAdjunto, setTipoAdjunto] = useState('cedula_identidad')
  const [uploading, setUploading] = useState(false)

  const cargarFondo = useCallback(async () => {
    try {
      const res = await fondosPublicoAPI.obtenerActivo()
      setFondo(res.data)
    } catch {
      setError('No hay fondos concursables abiertos actualmente.')
    }
  }, [])

  const cargarBorrador = useCallback(async (cod: string) => {
    // Para retomar, necesitamos el RUT. Pedir al usuario.
    const rutGuardado = sessionStorage.getItem(`postulacion_rut_${cod}`)
    if (!rutGuardado) return

    try {
      const res = await fondosPublicoAPI.consultar(cod, rutGuardado)
      if (res.data.estado === 'borrador') {
        setNombre(res.data.nombre_postulante || '')
        setRut(rutGuardado)
        setEmail(res.data.email_postulante || '')
        setTelefono(res.data.telefono_postulante || '')
        setDatos(res.data.contenido_json || {})
        setItemsFinanciamiento(res.data.items_financiamiento || [])
        setAdjuntos((res.data.adjuntos || []) as PostulacionAdjunto[])
        setActiveStep((res.data.paso_actual || 1) - 1)
      }
    } catch {
      // No se pudo cargar, empezar de cero
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await cargarFondo()
      if (codigoParam) {
        await cargarBorrador(codigoParam)
      }
      setLoading(false)
    }
    init()
  }, [codigoParam, cargarFondo, cargarBorrador])

  const guardarBorrador = async () => {
    if (!codigo || !rut) return
    setSaving(true)
    try {
      await fondosPublicoAPI.guardarBorrador(codigo, {
        rut_postulante: rut,
        nombre_postulante: nombre,
        email_postulante: email,
        telefono_postulante: telefono,
        contenido_json: datos,
        paso_actual: activeStep + 1,
        items_financiamiento: itemsFinanciamiento,
      })
    } catch {
      // Silently fail on auto-save
    } finally {
      setSaving(false)
    }
  }

  const crearPostulacion = async () => {
    if (!fondo) return
    try {
      const res = await fondosPublicoAPI.postular({
        fondo_id: fondo.id,
        nombre_postulante: nombre,
        rut_postulante: rut,
        email_postulante: email,
        telefono_postulante: telefono,
        contenido_json: datos,
      })
      setCodigo(res.data.codigo)
      sessionStorage.setItem(`postulacion_rut_${res.data.codigo}`, rut)
      return res.data.codigo
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear la postulación'
      setError(message)
      return null
    }
  }

  const handleNext = async () => {
    setError(null)

    // Validaciones por paso
    if (activeStep === 0) {
      if (!nombre.trim() || !rut.trim()) {
        setError('Nombre y RUT son obligatorios')
        return
      }
      // Si no hay código aún, crear postulación
      if (!codigo) {
        const nuevoCodigo = await crearPostulacion()
        if (!nuevoCodigo) return
      }
    }

    // Guardar borrador automáticamente
    if (codigo) {
      await guardarBorrador()
    }

    setActiveStep((prev) => prev + 1)
  }

  const handleBack = () => {
    setActiveStep((prev) => prev - 1)
  }

  const handleEnviar = async () => {
    if (!codigo || !rut) return
    setEnviando(true)
    setError(null)
    try {
      // Guardar último paso
      await guardarBorrador()
      // Enviar
      const res = await fondosPublicoAPI.enviar(codigo, rut)
      setCodigoFinal(res.data.codigo)
      setEnviado(true)
    } catch (err: unknown) {
      const errorData = (err as { response?: { data?: { message?: string } } })?.response?.data
      setError(errorData?.message || 'Error al enviar la postulación')
    } finally {
      setEnviando(false)
    }
  }

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !codigo || !rut) return
    setUploading(true)
    try {
      const res = await fondosPublicoAPI.subirAdjunto(codigo, rut, e.target.files[0], tipoAdjunto)
      setAdjuntos((prev) => [...prev, res.data])
    } catch {
      setError('Error al subir el archivo')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteAdjunto = async (adjuntoId: number) => {
    if (!codigo || !rut) return
    try {
      await fondosPublicoAPI.eliminarAdjunto(codigo, adjuntoId, rut)
      setAdjuntos((prev) => prev.filter((a) => a.id !== adjuntoId))
    } catch {
      setError('Error al eliminar el archivo')
    }
  }

  const updateDatos = (field: string, value: unknown) => {
    setDatos((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!fondo) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ bgcolor: '#0071BC', color: 'white', py: 3 }}>
          <Container maxWidth="md">
            <Typography variant="h5" fontWeight="bold">Tu Negocio Crece</Typography>
          </Container>
        </Box>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Alert severity="warning">No hay fondos concursables abiertos actualmente.</Alert>
          <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>Volver al inicio</Button>
        </Container>
      </Box>
    )
  }

  // Pantalla de éxito
  if (enviado && codigoFinal) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ bgcolor: '#0071BC', color: 'white', py: 3 }}>
          <Container maxWidth="md">
            <Typography variant="h5" fontWeight="bold">Tu Negocio Crece</Typography>
          </Container>
        </Box>
        <Container maxWidth="sm" sx={{ py: 6 }}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <SuccessIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Postulación Enviada
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Su postulación ha sido recibida exitosamente.
            </Typography>
            <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Su código de seguimiento es:
              </Typography>
              <Typography variant="h4" fontWeight="bold" color="primary" sx={{ fontFamily: 'monospace' }}>
                {codigoFinal}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Guarde este código. Lo necesitará para consultar el estado de su postulación.
              </Typography>
            </Paper>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={() => navigate('/')}
              >
                Volver al Inicio
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/fondos/seguimiento')}
              >
                Consultar Estado
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#0071BC', color: 'white', py: 3 }}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              component="img"
              src="/logo.png"
              alt="Municipalidad"
              sx={{ height: 48, width: 'auto' }}
            />
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {fondo.nombre}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Formulario de Postulación
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Stepper */}
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {codigo && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Código de postulación: <strong>{codigo}</strong> {saving && '(guardando...)'}
          </Alert>
        )}

        <Paper sx={{ p: 4 }}>
          {/* Paso 1: Datos del Emprendedor */}
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                1. Datos del Emprendedor
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    label="Nombre Completo"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    label="RUT"
                    placeholder="12345678-9"
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Teléfono"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Fecha de Nacimiento"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={(datos.fecha_nacimiento as string) || ''}
                    onChange={(e) => updateDatos('fecha_nacimiento', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Dirección"
                    value={(datos.direccion as string) || ''}
                    onChange={(e) => updateDatos('direccion', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Género</InputLabel>
                    <Select
                      value={(datos.genero as string) || ''}
                      label="Género"
                      onChange={(e) => updateDatos('genero', e.target.value)}
                    >
                      <MenuItem value="masculino">Masculino</MenuItem>
                      <MenuItem value="femenino">Femenino</MenuItem>
                      <MenuItem value="otro">Otro</MenuItem>
                      <MenuItem value="prefiero_no_decir">Prefiero no decir</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Nivel Educacional</InputLabel>
                    <Select
                      value={(datos.nivel_educacional as string) || ''}
                      label="Nivel Educacional"
                      onChange={(e) => updateDatos('nivel_educacional', e.target.value)}
                    >
                      <MenuItem value="basica">Básica</MenuItem>
                      <MenuItem value="media">Media</MenuItem>
                      <MenuItem value="tecnica">Técnica</MenuItem>
                      <MenuItem value="universitaria">Universitaria</MenuItem>
                      <MenuItem value="postgrado">Postgrado</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Pueblo Originario</InputLabel>
                    <Select
                      value={(datos.pueblo_originario as string) || 'no'}
                      label="Pueblo Originario"
                      onChange={(e) => updateDatos('pueblo_originario', e.target.value)}
                    >
                      <MenuItem value="no">No pertenece</MenuItem>
                      <MenuItem value="yagan">Yagán</MenuItem>
                      <MenuItem value="kawesqar">Kawésqar</MenuItem>
                      <MenuItem value="mapuche">Mapuche</MenuItem>
                      <MenuItem value="otro">Otro</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Registro Social de Hogares (%)</InputLabel>
                    <Select
                      value={(datos.rsh_tramo as string) || ''}
                      label="Registro Social de Hogares (%)"
                      onChange={(e) => updateDatos('rsh_tramo', e.target.value)}
                    >
                      <MenuItem value="0-40">0% - 40%</MenuItem>
                      <MenuItem value="41-60">41% - 60%</MenuItem>
                      <MenuItem value="61-80">61% - 80%</MenuItem>
                      <MenuItem value="81-100">81% - 100%</MenuItem>
                      <MenuItem value="no_tiene">No tiene</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Paso 2: Datos del Emprendimiento */}
          {activeStep === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                2. Datos del Emprendimiento
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Nombre del Emprendimiento"
                    value={(datos.nombre_emprendimiento as string) || ''}
                    onChange={(e) => updateDatos('nombre_emprendimiento', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Rubro</InputLabel>
                    <Select
                      value={(datos.rubro as string) || ''}
                      label="Rubro"
                      onChange={(e) => updateDatos('rubro', e.target.value)}
                    >
                      <MenuItem value="comercio">Comercio</MenuItem>
                      <MenuItem value="servicios">Servicios</MenuItem>
                      <MenuItem value="turismo">Turismo</MenuItem>
                      <MenuItem value="gastronomia">Gastronomía</MenuItem>
                      <MenuItem value="artesania">Artesanía</MenuItem>
                      <MenuItem value="pesca">Pesca</MenuItem>
                      <MenuItem value="agricultura">Agricultura</MenuItem>
                      <MenuItem value="tecnologia">Tecnología</MenuItem>
                      <MenuItem value="otro">Otro</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Antigüedad del Negocio"
                    placeholder="Ej: 2 años"
                    value={(datos.antiguedad_negocio as string) || ''}
                    onChange={(e) => updateDatos('antiguedad_negocio', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Dirección del Emprendimiento"
                    value={(datos.direccion_emprendimiento as string) || ''}
                    onChange={(e) => updateDatos('direccion_emprendimiento', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Tiene Patente Comercial</InputLabel>
                    <Select
                      value={(datos.tiene_patente as string) || ''}
                      label="Tiene Patente Comercial"
                      onChange={(e) => updateDatos('tiene_patente', e.target.value)}
                    >
                      <MenuItem value="si">Sí</MenuItem>
                      <MenuItem value="no">No</MenuItem>
                      <MenuItem value="en_tramite">En trámite</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Tiene Inicio de Actividades</InputLabel>
                    <Select
                      value={(datos.tiene_inicio_actividades as string) || ''}
                      label="Tiene Inicio de Actividades"
                      onChange={(e) => updateDatos('tiene_inicio_actividades', e.target.value)}
                    >
                      <MenuItem value="si">Sí</MenuItem>
                      <MenuItem value="no">No</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Número de Trabajadores"
                    type="number"
                    value={(datos.num_trabajadores as string) || ''}
                    onChange={(e) => updateDatos('num_trabajadores', e.target.value)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Ventas Mensuales Promedio ($)"
                    type="number"
                    value={(datos.ventas_mensuales as string) || ''}
                    onChange={(e) => updateDatos('ventas_mensuales', e.target.value)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Paso 3: Plan de Negocio */}
          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                3. Plan de Negocio
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Descripción del Proyecto"
                    helperText="Describa brevemente su proyecto y en qué consiste"
                    value={(datos.descripcion_proyecto as string) || ''}
                    onChange={(e) => updateDatos('descripcion_proyecto', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Objetivo General"
                    value={(datos.objetivo_general as string) || ''}
                    onChange={(e) => updateDatos('objetivo_general', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Objetivos Específicos"
                    helperText="Liste los objetivos específicos de su proyecto"
                    value={(datos.objetivos_especificos as string) || ''}
                    onChange={(e) => updateDatos('objetivos_especificos', e.target.value)}
                  />
                </Grid>
                <Divider sx={{ width: '100%', my: 1 }} />
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Clientes Objetivo"
                    helperText="¿A quién va dirigido su producto o servicio?"
                    value={(datos.clientes_objetivo as string) || ''}
                    onChange={(e) => updateDatos('clientes_objetivo', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Estrategia Comercial y Marketing"
                    helperText="¿Cómo dará a conocer y venderá su producto/servicio?"
                    value={(datos.estrategia_comercial as string) || ''}
                    onChange={(e) => updateDatos('estrategia_comercial', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Innovación"
                    helperText="¿Qué tiene de innovador su proyecto?"
                    value={(datos.innovacion as string) || ''}
                    onChange={(e) => updateDatos('innovacion', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Impacto Económico Local"
                    helperText="¿Cómo impactará su proyecto en la economía local?"
                    value={(datos.impacto_economico as string) || ''}
                    onChange={(e) => updateDatos('impacto_economico', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Sustentabilidad del Proyecto"
                    helperText="¿Cómo se mantendrá su proyecto en el tiempo?"
                    value={(datos.sustentabilidad as string) || ''}
                    onChange={(e) => updateDatos('sustentabilidad', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Asociatividad"
                    helperText="¿Participa en alguna asociación o trabaja con otros emprendedores?"
                    value={(datos.asociatividad as string) || ''}
                    onChange={(e) => updateDatos('asociatividad', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Proveedores Locales"
                    helperText="¿Utiliza proveedores de la zona? Detalle."
                    value={(datos.proveedores_locales as string) || ''}
                    onChange={(e) => updateDatos('proveedores_locales', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Paso 4: Plan de Financiamiento */}
          {activeStep === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                4. Plan de Inversión y Financiamiento
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Detalle los ítems que requiere financiar. El monto máximo por proyecto es de{' '}
                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(fondo.monto_maximo_por_proyecto)}.
              </Typography>
              <FinanciamientoTable
                items={itemsFinanciamiento}
                onChange={setItemsFinanciamiento}
              />
            </Box>
          )}

          {/* Paso 5: Documentos Adjuntos */}
          {activeStep === 4 && (
            <Box>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                5. Documentos Adjuntos
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Adjunte los documentos requeridos. Tamaño máximo: 10 MB por archivo.
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Tipo de Documento</InputLabel>
                  <Select
                    size="small"
                    value={tipoAdjunto}
                    label="Tipo de Documento"
                    onChange={(e) => setTipoAdjunto(e.target.value)}
                  >
                    {TIPOS_ADJUNTO.map((t) => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={uploading ? <CircularProgress size={16} /> : <UploadIcon />}
                  disabled={uploading}
                >
                  {uploading ? 'Subiendo...' : 'Seleccionar Archivo'}
                  <input type="file" hidden onChange={handleUploadFile} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                </Button>
              </Box>

              <List>
                {adjuntos.map((adj) => (
                  <ListItem key={adj.id} divider>
                    <ListItemText
                      primary={adj.nombre_archivo}
                      secondary={
                        <Chip
                          label={TIPOS_ADJUNTO.find(t => t.value === adj.tipo_documento)?.label || adj.tipo_documento}
                          size="small"
                          variant="outlined"
                        />
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" color="error" onClick={() => handleDeleteAdjunto(adj.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
                {adjuntos.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No se han adjuntado documentos
                  </Typography>
                )}
              </List>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              onClick={activeStep === 0 ? () => navigate('/') : handleBack}
              startIcon={<BackIcon />}
            >
              {activeStep === 0 ? 'Volver' : 'Anterior'}
            </Button>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {activeStep < steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  endIcon={<NextIcon />}
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleEnviar}
                  endIcon={enviando ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  disabled={enviando}
                >
                  {enviando ? 'Enviando...' : 'Enviar Postulación'}
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}

export default PostulacionForm
