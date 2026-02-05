import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  TextField,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Send as SendIcon,
  AttachFile as AttachIcon,
  Description as DocIcon,
  History as HistoryIcon,
} from '@mui/icons-material'
import { oirsFuncionarioAPI } from '../../api/oirs'
import { OirsSolicitud, OirsHistorial, OirsAdjunto } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoColors: Record<string, 'warning' | 'info' | 'success' | 'default' | 'error'> = {
  recibido: 'default',
  asignada: 'info',
  pendiente: 'warning',
  en_analisis: 'info',
  derivado: 'warning',
  respondido: 'success',
  cerrado: 'default',
}

const prioridadColors: Record<string, 'error' | 'warning' | 'info'> = {
  alta: 'error',
  media: 'warning',
  baja: 'info',
}

const tipoLabels: Record<string, string> = {
  consulta: 'Consulta',
  reclamo: 'Reclamo',
  sugerencia: 'Sugerencia',
  felicitacion: 'Felicitacion',
  solicitud_informacion: 'Solicitud de Informacion',
}

const OirsFuncionarioDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [solicitud, setSolicitud] = useState<OirsSolicitud | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form para respuesta
  const [respuesta, setRespuesta] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (id) {
      loadSolicitud(parseInt(id))
    }
  }, [id])

  const loadSolicitud = async (solId: number) => {
    setLoading(true)
    setError('')
    try {
      const response = await oirsFuncionarioAPI.obtener(solId)
      setSolicitud(response.data)
      // Pre-cargar respuesta anterior del funcionario si existe
      if (response.data.respuesta_funcionario) {
        setRespuesta(response.data.respuesta_funcionario)
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } }
      if (error.response?.status === 403) {
        setError('No tienes permiso para ver esta solicitud')
      } else {
        setError('Error al cargar la solicitud')
      }
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      setArchivo(files[0])
    }
  }

  const handleEnviarRespuesta = async () => {
    if (!id || !respuesta.trim()) return

    setEnviando(true)
    setError('')
    setSuccess('')

    try {
      await oirsFuncionarioAPI.responderInterno(parseInt(id), respuesta, archivo || undefined)
      setSuccess('Respuesta enviada correctamente. El encargado OIRS revisara tu respuesta.')
      setArchivo(null)
      // Recargar la solicitud
      loadSolicitud(parseInt(id))
    } catch (err) {
      setError('Error al enviar la respuesta')
      console.error(err)
    } finally {
      setEnviando(false)
    }
  }

  const puedeResponder = solicitud && ['asignada', 'en_analisis'].includes(solicitud.estado)

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error && !solicitud) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Volver
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  if (!solicitud) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Volver
        </Button>
        <Alert severity="warning">Solicitud no encontrada</Alert>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/mis-solicitudes')}>
            Volver
          </Button>
          <Typography variant="h4" fontWeight="bold">
            {solicitud.folio}
          </Typography>
          <Chip
            label={solicitud.estado.replace('_', ' ')}
            color={estadoColors[solicitud.estado] || 'default'}
          />
          <Chip
            label={`Prioridad: ${solicitud.prioridad}`}
            color={prioridadColors[solicitud.prioridad]}
            variant="outlined"
          />
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* Columna Principal */}
        <Grid item xs={12} md={8}>
          {/* Informacion de la Solicitud */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Informacion de la Solicitud
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Tipo de Solicitud
                  </Typography>
                  <Typography>{tipoLabels[solicitud.tipo_solicitud] || solicitud.tipo_solicitud}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Categoria
                  </Typography>
                  <Typography sx={{ textTransform: 'capitalize' }}>
                    {solicitud.categoria.replace('_', ' ')}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Asunto
                  </Typography>
                  <Typography fontWeight="medium">{solicitud.asunto}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Descripcion
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{solicitud.descripcion}</Typography>
                </Grid>
                {solicitud.fecha_hecho && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Fecha del Hecho
                    </Typography>
                    <Typography>
                      {format(new Date(solicitud.fecha_hecho), 'dd/MM/yyyy', { locale: es })}
                    </Typography>
                  </Grid>
                )}
                {solicitud.lugar_hecho && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Lugar del Hecho
                    </Typography>
                    <Typography>{solicitud.lugar_hecho}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Archivos Adjuntos del Solicitante */}
          {solicitud.adjuntos && solicitud.adjuntos.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Archivos Adjuntos del Solicitante
                </Typography>
                <List dense>
                  {solicitud.adjuntos
                    .filter((adj: OirsAdjunto) => !adj.origen || adj.origen === 'solicitante')
                    .map((adj: OirsAdjunto) => (
                      <ListItem key={adj.id}>
                        <ListItemIcon>
                          <DocIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={adj.nombre_archivo}
                          secondary={adj.tipo_mime}
                        />
                      </ListItem>
                    ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Formulario de Respuesta */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tu Respuesta
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Esta respuesta sera enviada al encargado OIRS para su revision antes de ser comunicada al ciudadano.
              </Typography>

              {solicitud.respuesta_funcionario && solicitud.fecha_respuesta_funcionario && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Ya enviaste una respuesta el{' '}
                  {format(new Date(solicitud.fecha_respuesta_funcionario), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}.
                  Puedes actualizarla si es necesario.
                </Alert>
              )}

              <TextField
                fullWidth
                multiline
                rows={6}
                label="Escribe tu respuesta"
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                disabled={!puedeResponder || enviando}
                placeholder="Detalla tu respuesta a esta solicitud..."
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
                <Button
                  variant="outlined"
                  startIcon={<AttachIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!puedeResponder || enviando}
                >
                  Adjuntar Archivo
                </Button>
                {archivo && (
                  <Chip
                    label={archivo.name}
                    onDelete={() => setArchivo(null)}
                    size="small"
                  />
                )}
              </Box>

              <Button
                variant="contained"
                startIcon={enviando ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                onClick={handleEnviarRespuesta}
                disabled={!puedeResponder || !respuesta.trim() || enviando}
              >
                {enviando ? 'Enviando...' : 'Enviar Respuesta'}
              </Button>

              {!puedeResponder && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Esta solicitud no esta en un estado que permita enviar respuesta.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Columna Lateral */}
        <Grid item xs={12} md={4}>
          {/* Datos del Solicitante */}
          {!solicitud.anonimo && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Datos del Solicitante
                </Typography>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Nombre
                  </Typography>
                  <Typography variant="body2">{solicitud.nombre_solicitante || '-'}</Typography>
                </Box>
                {solicitud.rut_solicitante && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      RUT
                    </Typography>
                    <Typography variant="body2">{solicitud.rut_solicitante}</Typography>
                  </Box>
                )}
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body2">{solicitud.email_solicitante || '-'}</Typography>
                </Box>
                {solicitud.telefono_solicitante && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Telefono
                    </Typography>
                    <Typography variant="body2">{solicitud.telefono_solicitante}</Typography>
                  </Box>
                )}
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Medio de Respuesta Preferido
                  </Typography>
                  <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                    {solicitud.medio_respuesta.replace('_', ' ')}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          )}

          {solicitud.anonimo && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Alert severity="info">
                  Esta es una solicitud anonima
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Fechas Importantes */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Fechas
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Fecha de Ingreso
                </Typography>
                <Typography variant="body2">
                  {format(new Date(solicitud.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                </Typography>
              </Box>
              {solicitud.fecha_limite_respuesta && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Fecha Limite de Respuesta
                  </Typography>
                  <Typography
                    variant="body2"
                    color={new Date(solicitud.fecha_limite_respuesta) < new Date() ? 'error' : 'inherit'}
                    fontWeight={new Date(solicitud.fecha_limite_respuesta) < new Date() ? 'bold' : 'normal'}
                  >
                    {format(new Date(solicitud.fecha_limite_respuesta), 'dd/MM/yyyy', { locale: es })}
                    {new Date(solicitud.fecha_limite_respuesta) < new Date() && ' (VENCIDA)'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Historial */}
          {solicitud.historial && solicitud.historial.length > 0 && (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <HistoryIcon fontSize="small" />
                  <Typography variant="h6">Historial</Typography>
                </Box>
                <List dense>
                  {solicitud.historial.map((h: OirsHistorial) => (
                    <ListItem key={h.id} disablePadding sx={{ mb: 1 }}>
                      <ListItemText
                        primary={h.accion}
                        secondary={
                          <>
                            {h.usuario?.nombre || 'Sistema'} -{' '}
                            {format(new Date(h.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                            {h.observaciones && (
                              <>
                                <br />
                                <Typography variant="caption" color="text.secondary">
                                  {h.observaciones}
                                </Typography>
                              </>
                            )}
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  )
}

export default OirsFuncionarioDetail
