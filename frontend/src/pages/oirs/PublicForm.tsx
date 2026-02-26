import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Checkbox,
  FormControlLabel,
  CircularProgress,
} from '@mui/material'
import { Send as SendIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { oirsPublicoAPI } from '../../api/oirs'

const tiposSolicitud = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'reclamo', label: 'Reclamo' },
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'felicitacion', label: 'Felicitación' },
  { value: 'solicitud_informacion', label: 'Solicitud de Información' },
]

const categorias = [
  { value: 'obras_municipales', label: 'Obras Municipales' },
  { value: 'aseo_ornato', label: 'Aseo y Ornato' },
  { value: 'transito', label: 'Tránsito' },
  { value: 'educacion', label: 'Educación' },
  { value: 'salud', label: 'Salud' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'medio_ambiente', label: 'Medio Ambiente' },
  { value: 'otro', label: 'Otro' },
]

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const OirsPublicForm = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [success, setSuccess] = useState<{ folio: string } | null>(null)

  const [formData, setFormData] = useState({
    tipo_solicitud: '',
    nombre_solicitante: '',
    rut_solicitante: '',
    email_solicitante: '',
    telefono_solicitante: '',
    direccion_solicitante: '',
    comuna_solicitante: 'Cabo de Hornos',
    anonimo: false,
    categoria: '',
    asunto: '',
    descripcion: '',
    medio_respuesta: 'email',
  })

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    try {
      const response = await oirsPublicoAPI.crear(formData)
      setSuccess({ folio: response.data.folio })
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'Error al enviar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  const steps = ['Tipo de Solicitud', 'Datos Personales', 'Detalle', 'Confirmación']

  if (success) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
        <Container maxWidth="md">
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h4" color="success.main" gutterBottom>
                ¡Solicitud Enviada!
              </Typography>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Su número de folio es:
              </Typography>
              <Typography
                variant="h3"
                fontWeight="bold"
                color="primary"
                sx={{ mb: 4, p: 2, bgcolor: 'primary.light', borderRadius: 2, color: 'white' }}
              >
                {success.folio}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Guarde este número para consultar el estado de su solicitud
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button variant="outlined" onClick={() => navigate('/')}>
                  Volver al Inicio
                </Button>
                <Button variant="contained" onClick={() => navigate('/oirs/consultar')}>
                  Consultar Estado
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: '#EE5825',
          color: 'white',
          py: 4,
        }}
      >
        <Container maxWidth="md">
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/')}
            sx={{ color: 'white', mb: 2 }}
          >
            Volver
          </Button>
          <Typography variant="h4" fontWeight="bold">
            Oficina de Información, Reclamos y Sugerencias
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Municipalidad de Cabo de Hornos
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stepper activeStep={step} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Card>
          <CardContent>
            {step === 0 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    ¿Qué tipo de solicitud desea realizar?
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    select
                    label="Tipo de Solicitud"
                    value={formData.tipo_solicitud}
                    onChange={(e) => handleChange('tipo_solicitud', e.target.value)}
                    required
                  >
                    {tiposSolicitud.map((tipo) => (
                      <MenuItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    select
                    label="Categoría"
                    value={formData.categoria}
                    onChange={(e) => handleChange('categoria', e.target.value)}
                    required
                  >
                    {categorias.map((cat) => (
                      <MenuItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            )}

            {step === 1 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Datos de Contacto
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.anonimo}
                        onChange={(e) => handleChange('anonimo', e.target.checked)}
                      />
                    }
                    label="Solicitud anónima (no se requieren datos personales)"
                  />
                </Grid>
                {!formData.anonimo && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        required
                        label="Nombre Completo"
                        value={formData.nombre_solicitante}
                        onChange={(e) => handleChange('nombre_solicitante', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="RUT"
                        value={formData.rut_solicitante}
                        onChange={(e) => handleChange('rut_solicitante', e.target.value)}
                        placeholder="12345678-9"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        required
                        type="email"
                        label="Correo Electrónico"
                        value={formData.email_solicitante}
                        onChange={(e) => {
                          handleChange('email_solicitante', e.target.value)
                          if (emailError && validateEmail(e.target.value)) setEmailError('')
                        }}
                        onBlur={() => {
                          if (formData.email_solicitante && !validateEmail(formData.email_solicitante)) {
                            setEmailError('Ingrese un correo electrónico válido')
                          } else {
                            setEmailError('')
                          }
                        }}
                        error={!!emailError}
                        helperText={emailError}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Teléfono"
                        value={formData.telefono_solicitante}
                        onChange={(e) => handleChange('telefono_solicitante', e.target.value)}
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            )}

            {step === 2 && (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Detalle de la Solicitud
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Asunto"
                    value={formData.asunto}
                    onChange={(e) => handleChange('asunto', e.target.value)}
                    placeholder="Resumen breve de su solicitud"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    multiline
                    rows={6}
                    label="Descripción"
                    value={formData.descripcion}
                    onChange={(e) => handleChange('descripcion', e.target.value)}
                    placeholder="Describa en detalle su consulta, reclamo o sugerencia"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    select
                    label="Medio de Respuesta Preferido"
                    value={formData.medio_respuesta}
                    onChange={(e) => handleChange('medio_respuesta', e.target.value)}
                  >
                    <MenuItem value="email">Correo Electrónico</MenuItem>
                    <MenuItem value="telefono">Teléfono</MenuItem>
                    <MenuItem value="carta_certificada">Carta Certificada</MenuItem>
                    <MenuItem value="presencial">Presencial</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            )}

            {step === 3 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Resumen de la Solicitud
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Tipo
                    </Typography>
                    <Typography>
                      {tiposSolicitud.find((t) => t.value === formData.tipo_solicitud)?.label}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Categoría
                    </Typography>
                    <Typography>
                      {categorias.find((c) => c.value === formData.categoria)?.label}
                    </Typography>
                  </Grid>
                  {!formData.anonimo && (
                    <>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Nombre
                        </Typography>
                        <Typography>{formData.nombre_solicitante}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Email
                        </Typography>
                        <Typography>{formData.email_solicitante}</Typography>
                      </Grid>
                    </>
                  )}
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Asunto
                    </Typography>
                    <Typography>{formData.asunto}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Descripción
                    </Typography>
                    <Typography>{formData.descripcion}</Typography>
                  </Grid>
                </Grid>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                disabled={step === 0}
                onClick={() => setStep((prev) => prev - 1)}
              >
                Anterior
              </Button>
              {step < 3 ? (
                <Button
                  variant="contained"
                  onClick={() => setStep((prev) => prev + 1)}
                  disabled={
                    (step === 0 && (!formData.tipo_solicitud || !formData.categoria)) ||
                    (step === 1 && !formData.anonimo && (!formData.nombre_solicitante || !formData.email_solicitante || !validateEmail(formData.email_solicitante))) ||
                    (step === 2 && (!formData.asunto || !formData.descripcion))
                  }
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? 'Enviando...' : 'Enviar Solicitud'}
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}

export default OirsPublicForm
