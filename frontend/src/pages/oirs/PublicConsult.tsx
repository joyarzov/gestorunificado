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
  Alert,
  Chip,
  Divider,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material'
import { Search as SearchIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { oirsPublicoAPI } from '../../api/oirs'
import { OirsSolicitud } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoColors: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  recibido: 'default',
  asignada: 'info',
  pendiente: 'warning',
  en_analisis: 'info',
  derivado: 'warning',
  respondido: 'success',
  cerrado: 'success',
}

const estadoLabels: Record<string, string> = {
  recibido: 'Recibido',
  asignada: 'Asignada',
  pendiente: 'Pendiente',
  en_analisis: 'En Análisis',
  derivado: 'Derivado',
  respondido: 'Respondido',
  cerrado: 'Cerrado',
}

const OirsPublicConsult = () => {
  const navigate = useNavigate()
  const [folio, setFolio] = useState('')
  const [rut, setRut] = useState('')
  const [codigoSeguimiento, setCodigoSeguimiento] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [solicitud, setSolicitud] = useState<OirsSolicitud | null>(null)

  const handleSearch = async () => {
    if (!folio) {
      setError('Debe ingresar un número de folio')
      return
    }

    setError('')
    setLoading(true)
    setSolicitud(null)

    try {
      const credencial: { rut?: string; codigo_seguimiento?: string } = {}
      if (rut.trim()) credencial.rut = rut.trim()
      if (codigoSeguimiento.trim()) credencial.codigo_seguimiento = codigoSeguimiento.trim().toUpperCase()
      const response = await oirsPublicoAPI.consultar(folio, credencial)
      setSolicitud(response.data)
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'No se encontró la solicitud')
    } finally {
      setLoading(false)
    }
  }

  const getStepIndex = (estado: string) => {
    const steps = ['recibido', 'asignada', 'en_analisis', 'respondido', 'cerrado']
    return steps.indexOf(estado)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: '#28A9E3',
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
            Consultar Estado de Solicitud
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Ingrese su número de folio para consultar el estado
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Número de Folio"
                  placeholder="OIRS-2024-00001"
                  value={folio}
                  onChange={(e) => setFolio(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="RUT (opcional)"
                  placeholder="12345678-9"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  helperText="O use el código"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Código seguimiento"
                  placeholder="XXXX-XXXX"
                  value={codigoSeguimiento}
                  onChange={(e) => setCodigoSeguimiento(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  helperText="Útil si es anónimo"
                  inputProps={{ style: { fontFamily: 'monospace', letterSpacing: 1 } }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
                  onClick={handleSearch}
                  disabled={loading}
                  sx={{ height: 56 }}
                >
                  Consultar
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {solicitud && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {solicitud.folio}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {format(new Date(solicitud.created_at), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </Typography>
                </Box>
                <Chip
                  label={estadoLabels[solicitud.estado] || solicitud.estado}
                  color={estadoColors[solicitud.estado] || 'default'}
                  size="medium"
                />
              </Box>

              <Stepper
                activeStep={getStepIndex(solicitud.estado)}
                alternativeLabel
                sx={{ mb: 4 }}
              >
                <Step completed={getStepIndex(solicitud.estado) >= 0}>
                  <StepLabel>Recibido</StepLabel>
                </Step>
                <Step completed={getStepIndex(solicitud.estado) >= 1}>
                  <StepLabel>Asignada</StepLabel>
                </Step>
                <Step completed={getStepIndex(solicitud.estado) >= 2}>
                  <StepLabel>En Análisis</StepLabel>
                </Step>
                <Step completed={getStepIndex(solicitud.estado) >= 3}>
                  <StepLabel>Respondido</StepLabel>
                </Step>
                <Step completed={getStepIndex(solicitud.estado) >= 4}>
                  <StepLabel>Cerrado</StepLabel>
                </Step>
              </Stepper>

              <Divider sx={{ my: 3 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Tipo de Solicitud
                  </Typography>
                  <Typography sx={{ textTransform: 'capitalize' }}>
                    {solicitud.tipo_solicitud.replace('_', ' ')}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Categoría
                  </Typography>
                  <Typography sx={{ textTransform: 'capitalize' }}>
                    {solicitud.categoria.replace('_', ' ')}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Asunto
                  </Typography>
                  <Typography>{solicitud.asunto}</Typography>
                </Grid>
                {solicitud.unidad_responsable && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Unidad Responsable
                    </Typography>
                    <Typography>{solicitud.unidad_responsable.nombre}</Typography>
                  </Grid>
                )}
                {solicitud.fecha_limite_respuesta && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Fecha Límite de Respuesta
                    </Typography>
                    <Typography>
                      {format(new Date(solicitud.fecha_limite_respuesta), 'dd/MM/yyyy', { locale: es })}
                    </Typography>
                  </Grid>
                )}
              </Grid>

              {solicitud.respuesta && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Typography variant="h6" gutterBottom>
                    Respuesta
                  </Typography>
                  <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                    <Typography>{solicitud.respuesta}</Typography>
                    {solicitud.fecha_respuesta && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Respondido el {format(new Date(solicitud.fecha_respuesta), 'dd/MM/yyyy', { locale: es })}
                      </Typography>
                    )}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </Container>
    </Box>
  )
}

export default OirsPublicConsult
