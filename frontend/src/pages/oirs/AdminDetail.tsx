import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Divider,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Send as RespondIcon,
  PersonAdd as AsignarIcon,
} from '@mui/icons-material'
import { oirsAPI } from '../../api/oirs'
import { usersAPI, departamentosAPI } from '../../api/common'
import { OirsSolicitud, User, Departamento } from '../../types'
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

const OirsAdminDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [solicitud, setSolicitud] = useState<OirsSolicitud | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Diálogos
  const [asignarOpen, setAsignarOpen] = useState(false)
  const [responderOpen, setResponderOpen] = useState(false)

  // Datos para asignar
  const [funcionarios, setFuncionarios] = useState<User[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [funcionarioId, setFuncionarioId] = useState<number | ''>('')
  const [unidadId, setUnidadId] = useState<number | ''>('')

  // Respuesta
  const [respuesta, setRespuesta] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadSolicitud(parseInt(id))
      loadDatos()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadSolicitud = async (solicitudId: number) => {
    setLoading(true)
    try {
      const response = await oirsAPI.obtener(solicitudId)
      setSolicitud(response.data)
    } catch (err) {
      setError('Error al cargar la solicitud')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadDatos = async () => {
    try {
      const [funcResponse, deptoResponse] = await Promise.all([
        usersAPI.funcionarios(),
        departamentosAPI.listar(),
      ])
      setFuncionarios(funcResponse.data)
      setDepartamentos(deptoResponse.data)
    } catch (error) {
      console.error('Error cargando datos:', error)
    }
  }

  const handleAsignar = async () => {
    if (!funcionarioId || !id) return
    setActionLoading(true)
    try {
      await oirsAPI.asignar(parseInt(id), funcionarioId as number, unidadId as number || undefined)
      loadSolicitud(parseInt(id))
      setAsignarOpen(false)
    } catch (err) {
      console.error('Error al asignar:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleResponder = async () => {
    if (!respuesta || !id) return
    setActionLoading(true)
    try {
      await oirsAPI.responder(parseInt(id), respuesta)
      loadSolicitud(parseInt(id))
      setResponderOpen(false)
      setRespuesta('')
    } catch (err) {
      console.error('Error al responder:', err)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error || !solicitud) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Volver
        </Button>
        <Alert severity="error">{error || 'Solicitud no encontrada'}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Typography variant="h4" fontWeight="bold">
            {solicitud.folio}
          </Typography>
          <Chip
            label={solicitud.estado}
            color={estadoColors[solicitud.estado]}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<AsignarIcon />}
            onClick={() => setAsignarOpen(true)}
            disabled={solicitud.estado === 'cerrado'}
          >
            Asignar
          </Button>
          <Button
            variant="contained"
            startIcon={<RespondIcon />}
            onClick={() => {
              // Pre-cargar respuesta del funcionario si existe
              if (solicitud.respuesta_funcionario && !respuesta) {
                setRespuesta(solicitud.respuesta_funcionario)
              }
              setResponderOpen(true)
            }}
            disabled={solicitud.estado === 'cerrado' || solicitud.estado === 'respondido'}
          >
            Responder
          </Button>
        </Box>
      </Box>

      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12} md={8}>
          {/* Información de la solicitud */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Detalle de la Solicitud
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Tipo de Solicitud
                  </Typography>
                  <Typography sx={{ textTransform: 'capitalize' }}>
                    {solicitud.tipo_solicitud.replace('_', ' ')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
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
                  <Typography fontWeight="medium">{solicitud.asunto}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Descripción
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{solicitud.descripcion}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Respuesta del Funcionario (para revision del admin) */}
          {solicitud.respuesta_funcionario && (
            <Card sx={{ mb: 3, border: '2px solid', borderColor: 'info.main' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom color="info.main">
                  Respuesta del Funcionario (Pendiente de Revision)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  El funcionario asignado ha enviado la siguiente respuesta para su revision.
                  Puede usarla como base para responder al ciudadano.
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography sx={{ whiteSpace: 'pre-wrap', bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                  {solicitud.respuesta_funcionario}
                </Typography>
                {solicitud.fecha_respuesta_funcionario && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                    Enviado el {format(new Date(solicitud.fecha_respuesta_funcionario), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                    {solicitud.funcionario_asignado && ` por ${solicitud.funcionario_asignado.nombre}`}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          {/* Respuesta Final al Ciudadano */}
          {solicitud.respuesta && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="success.main">
                  Respuesta al Ciudadano
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{solicitud.respuesta}</Typography>
                {solicitud.fecha_respuesta && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                    Respondido el {format(new Date(solicitud.fecha_respuesta), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Datos del solicitante */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Solicitante
              </Typography>
              {solicitud.anonimo ? (
                <Typography color="text.secondary" fontStyle="italic">
                  Solicitud anónima
                </Typography>
              ) : (
                <Box>
                  <Typography>{solicitud.nombre_solicitante}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {solicitud.email_solicitante}
                  </Typography>
                  {solicitud.telefono_solicitante && (
                    <Typography variant="body2" color="text.secondary">
                      Tel: {solicitud.telefono_solicitante}
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Gestión */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Gestión
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Prioridad
                </Typography>
                <Chip
                  label={solicitud.prioridad}
                  color={solicitud.prioridad === 'alta' ? 'error' : solicitud.prioridad === 'media' ? 'warning' : 'info'}
                  size="small"
                  sx={{ ml: 1 }}
                />
              </Box>
              {solicitud.funcionario_asignado && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Funcionario Asignado
                  </Typography>
                  <Typography>{solicitud.funcionario_asignado.nombre}</Typography>
                </Box>
              )}
              {solicitud.unidad_responsable && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Unidad Responsable
                  </Typography>
                  <Typography>{solicitud.unidad_responsable.nombre}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Diálogo Asignar */}
      <Dialog open={asignarOpen} onClose={() => setAsignarOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Asignar Solicitud</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            select
            label="Funcionario"
            value={funcionarioId}
            onChange={(e) => setFuncionarioId(Number(e.target.value))}
            sx={{ mt: 2, mb: 2 }}
          >
            {funcionarios.map((func) => (
              <MenuItem key={func.id} value={func.id}>
                {func.nombre}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            select
            label="Unidad Responsable"
            value={unidadId}
            onChange={(e) => setUnidadId(Number(e.target.value))}
          >
            <MenuItem value="">Sin asignar</MenuItem>
            {departamentos.map((depto) => (
              <MenuItem key={depto.id} value={depto.id}>
                {depto.nombre}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAsignarOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleAsignar}
            disabled={!funcionarioId || actionLoading}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Asignar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo Responder */}
      <Dialog open={responderOpen} onClose={() => setResponderOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Responder Solicitud</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Respuesta"
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Escriba la respuesta a la solicitud..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResponderOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleResponder}
            disabled={!respuesta || actionLoading}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Enviar Respuesta'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default OirsAdminDetail
