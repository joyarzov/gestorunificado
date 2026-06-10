import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
} from '@mui/material'
import {
  VerifiedUser as VerifiedIcon,
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { verificacionAPI, DocumentoVerificado } from '../../api/verificacion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoColors: Record<string, 'success' | 'warning' | 'info' | 'default' | 'error'> = {
  firmado: 'success',
  borrador: 'default',
  pendiente_firma: 'warning',
  rechazado: 'error',
  anulado: 'error',
  pendiente: 'warning',
  recibido: 'info',
  archivado: 'default',
}

const estadoLabels: Record<string, string> = {
  firmado: 'Firmado',
  borrador: 'Borrador',
  pendiente_firma: 'Pendiente de Firma',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
  pendiente: 'Pendiente',
  recibido: 'Recibido',
  archivado: 'Archivado',
}

const VerificarDocumento = () => {
  const navigate = useNavigate()
  const { codigo: codigoParam } = useParams<{ codigo?: string }>()
  const [codigo, setCodigo] = useState(codigoParam || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<DocumentoVerificado | null>(null)

  useEffect(() => {
    if (codigoParam) {
      setCodigo(codigoParam)
      handleVerificar(codigoParam)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoParam])

  const handleVerificar = async (codigoToVerify?: string) => {
    const codigoFinal = codigoToVerify || codigo
    if (!codigoFinal.trim()) {
      setError('Debe ingresar un código de verificación')
      return
    }

    setError('')
    setLoading(true)
    setResultado(null)

    try {
      const response = await verificacionAPI.verificar(codigoFinal.trim())
      setResultado(response.data)
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'Documento no encontrado. El código ingresado no corresponde a ningún documento registrado.')
    } finally {
      setLoading(false)
    }
  }

  const formatFecha = (fecha?: string) => {
    if (!fecha) return '-'
    try {
      return format(new Date(fecha), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })
    } catch {
      return fecha
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: '#0071BC',
          color: 'white',
          py: 4,
        }}
      >
        <Container maxWidth="md">
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/portal-ciudadano')}
            sx={{ color: 'white', mb: 2 }}
          >
            Volver al portal
          </Button>
          <Typography variant="h4" fontWeight="bold">
            Verificar Documento
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Verifique la autenticidad de un documento municipal ingresando su código de verificación
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Código de Verificación"
                  placeholder="Ej: ABCD1234"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerificar()}
                  inputProps={{ maxLength: 12 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                  onClick={() => handleVerificar()}
                  disabled={loading}
                  sx={{
                    height: 56,
                    bgcolor: '#0071BC',
                    '&:hover': { bgcolor: '#005a96' },
                  }}
                >
                  Verificar
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

        {resultado && resultado.tipo_origen === 'documento' && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                {resultado.firmado ? (
                  <VerifiedIcon sx={{ fontSize: 48, color: '#2DC700' }} />
                ) : (
                  <WarningIcon sx={{ fontSize: 48, color: '#EE5825' }} />
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" fontWeight="bold">
                    Documento Verificado
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {resultado.firmado
                      ? 'Este documento ha sido firmado y es auténtico'
                      : 'Este documento existe en el sistema pero aún no está completamente firmado'}
                  </Typography>
                </Box>
                <Chip
                  label={estadoLabels[resultado.estado || ''] || resultado.estado}
                  color={estadoColors[resultado.estado || ''] || 'default'}
                  size="medium"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                {resultado.numero && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Número
                    </Typography>
                    <Typography fontWeight="bold">{resultado.numero}</Typography>
                  </Grid>
                )}
                {resultado.tipo_documental && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Tipo Documental
                    </Typography>
                    <Typography>{resultado.tipo_documental}</Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Título
                  </Typography>
                  <Typography>{resultado.titulo}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Fecha de Creación
                  </Typography>
                  <Typography>{formatFecha(resultado.fecha_creacion)}</Typography>
                </Grid>
                {resultado.fecha_firma && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Fecha de Firma
                    </Typography>
                    <Typography>{formatFecha(resultado.fecha_firma)}</Typography>
                  </Grid>
                )}
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Código de Verificación
                  </Typography>
                  <Typography fontWeight="bold" fontFamily="monospace">
                    {resultado.codigo}
                  </Typography>
                </Grid>
                {resultado.anio && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Año
                    </Typography>
                    <Typography>{resultado.anio}</Typography>
                  </Grid>
                )}
              </Grid>

              {resultado.firmantes && resultado.firmantes.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Firmantes
                  </Typography>
                  {resultado.firmantes.map((f, idx) => (
                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                      <Typography variant="body2">{f.nombre}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {f.fecha_firma ? formatFecha(f.fecha_firma) : ''}
                      </Typography>
                    </Box>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {resultado && resultado.tipo_origen === 'providencia' && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <VerifiedIcon sx={{ fontSize: 48, color: '#2DC700' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" fontWeight="bold">
                    Providencia Verificada
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Esta providencia fue generada oficialmente por el sistema de correspondencia municipal
                  </Typography>
                </Box>
                <Chip
                  label={estadoLabels[resultado.estado || ''] || resultado.estado}
                  color={estadoColors[resultado.estado || ''] || 'default'}
                  size="medium"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Folio
                  </Typography>
                  <Typography fontWeight="bold">{resultado.folio}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Fecha
                  </Typography>
                  <Typography>{formatFecha(resultado.fecha)}</Typography>
                </Grid>
                {resultado.remitente && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Remitente
                    </Typography>
                    <Typography>{resultado.remitente}</Typography>
                  </Grid>
                )}
                {resultado.departamento_destino && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Departamento Destino
                    </Typography>
                    <Typography>{resultado.departamento_destino}</Typography>
                  </Grid>
                )}
                {resultado.usuario_origen && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Emitido por
                    </Typography>
                    <Typography>{resultado.usuario_origen}</Typography>
                  </Grid>
                )}
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Código de Verificación
                  </Typography>
                  <Typography fontWeight="bold" fontFamily="monospace">
                    {resultado.codigo}
                  </Typography>
                </Grid>
              </Grid>

              {resultado.acciones && resultado.acciones.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Acciones
                  </Typography>
                  {resultado.acciones.map((accion, idx) => (
                    <Typography key={idx} variant="body2" sx={{ py: 0.25 }}>
                      - {accion}
                    </Typography>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </Container>

      {/* Footer */}
      <Box sx={{ bgcolor: 'grey.100', py: 4, mt: 'auto' }}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" textAlign="center">
            &copy; {new Date().getFullYear()} Ilustre Municipalidad de Cabo de Hornos. Todos los derechos reservados.
          </Typography>
        </Container>
      </Box>
    </Box>
  )
}

export default VerificarDocumento
