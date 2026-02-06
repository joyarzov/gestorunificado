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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  AttachFile as AttachIcon,
  Send as DerivacionIcon,
  History as HistoryIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  PictureAsPdf as PdfIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'
import { correspondenciaAPI, AlcaldeInfo } from '../../api/correspondencia'
import { Correspondencia, Adjunto } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import DerivacionDialog from '../../components/correspondencia/DerivacionDialog'
import Snackbar from '@mui/material/Snackbar'

const estadoColors: Record<string, 'warning' | 'info' | 'success' | 'secondary'> = {
  pendiente: 'warning',
  derivada_alcaldia: 'secondary',
  en_proceso: 'info',
  derivada_funcionario: 'info',
  completada: 'success',
  archivado: 'success',
}

const estadoLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  derivada_alcaldia: 'Derivada a Alcaldía',
  en_proceso: 'En Proceso',
  derivada_funcionario: 'Derivada a Funcionario',
  completada: 'Completada',
  archivado: 'Archivado',
}

const CorrespondenciaDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, canDerivarCorrespondence, isAdmin, isOficial, isAlcalde } = useAuth()
  const [correspondencia, setCorrespondencia] = useState<Correspondencia | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Derivacion dialog
  const [derivDialogOpen, setDerivDialogOpen] = useState(false)
  const [derivDialogReadOnly, setDerivDialogReadOnly] = useState(false)
  const [derivDialogMode, setDerivDialogMode] = useState<'alcalde' | 'funcionario'>('alcalde')
  const [alcaldeInfo, setAlcaldeInfo] = useState<AlcaldeInfo | null>(null)
  const [snackbar, setSnackbar] = useState({ open: false, message: '' })

  // Recibir derivación
  const [recibirLoading, setRecibirLoading] = useState(false)

  // PDF Viewer
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [viewerName, setViewerName] = useState('')
  const [viewerLoading, setViewerLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadCorrespondencia(parseInt(id))
    }
  }, [id])

  // Cleanup object URL on unmount or when dialog closes
  useEffect(() => {
    return () => {
      if (viewerUrl) URL.revokeObjectURL(viewerUrl)
    }
  }, [viewerUrl])

  const loadCorrespondencia = async (correspondenciaId: number) => {
    setLoading(true)
    try {
      const response = await correspondenciaAPI.obtener(correspondenciaId)
      setCorrespondencia(response.data)
    } catch (err) {
      setError('Error al cargar la correspondencia')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const isPendienteSinDerivaciones =
    correspondencia?.estado === 'pendiente' &&
    (!correspondencia?.derivaciones || correspondencia.derivaciones.length === 0)

  const handleDerivarAlcalde = async () => {
    try {
      const res = await correspondenciaAPI.obtenerAlcaldeInfo()
      setAlcaldeInfo(res.data)
      setDerivDialogReadOnly(true)
      setDerivDialogMode('alcalde')
      setDerivDialogOpen(true)
    } catch {
      setSnackbar({ open: true, message: 'No se pudo obtener info del Alcalde' })
    }
  }

  const handleDerivarFuncionario = () => {
    setAlcaldeInfo(null)
    setDerivDialogReadOnly(false)
    setDerivDialogMode('funcionario')
    setDerivDialogOpen(true)
  }

  const handleVerProvidencia = async () => {
    if (!correspondencia) return
    try {
      const blob = await correspondenciaAPI.descargarProvidencia(correspondencia.id)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      setViewerName('Providencia')
      setViewerUrl(url)
      setViewerOpen(true)
    } catch (err) {
      console.error('Error al cargar providencia:', err)
      setSnackbar({ open: true, message: 'Error al cargar la providencia' })
    }
  }

  const handleDerivacionSuccess = () => {
    setSnackbar({ open: true, message: 'Derivación realizada correctamente' })
    if (id) loadCorrespondencia(parseInt(id))
  }

  // Determinar si el funcionario puede marcar como recibida
  const isFuncionario = !isAdmin() && !isOficial() && !isAlcalde()
  const derivacionPendienteParaUsuario = correspondencia?.estado === 'derivada_funcionario'
    ? correspondencia.derivaciones?.find(
        (d) => d.estado === 'pendiente' && d.departamento_destino_id === user?.departamento_id
      )
    : undefined

  const handleMarcarRecibida = async () => {
    if (!derivacionPendienteParaUsuario) return
    setRecibirLoading(true)
    try {
      await correspondenciaAPI.recibirDerivacion(derivacionPendienteParaUsuario.id)
      setSnackbar({ open: true, message: 'Correspondencia marcada como recibida' })
      if (id) loadCorrespondencia(parseInt(id))
    } catch (err) {
      console.error('Error al marcar como recibida:', err)
      setSnackbar({ open: true, message: 'Error al marcar como recibida' })
    } finally {
      setRecibirLoading(false)
    }
  }

  const handleVerAdjunto = async (adjunto: Adjunto) => {
    setViewerLoading(true)
    setViewerName(adjunto.nombre_archivo)
    setViewerOpen(true)
    try {
      const blob = await correspondenciaAPI.descargarAdjunto(adjunto.id)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      setViewerUrl(url)
    } catch (err) {
      console.error('Error al cargar adjunto:', err)
    } finally {
      setViewerLoading(false)
    }
  }

  const handleDescargarAdjunto = async (adjunto: Adjunto) => {
    try {
      const blob = await correspondenciaAPI.descargarAdjunto(adjunto.id)
      const url = URL.createObjectURL(new Blob([blob]))
      const a = document.createElement('a')
      a.href = url
      a.download = adjunto.nombre_archivo
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al descargar adjunto:', err)
    }
  }

  const handleCloseViewer = () => {
    setViewerOpen(false)
    if (viewerUrl) {
      URL.revokeObjectURL(viewerUrl)
      setViewerUrl(null)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error || !correspondencia) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Volver
        </Button>
        <Alert severity="error">{error || 'Correspondencia no encontrada'}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Typography variant="h4" fontWeight="bold">
            Correspondencia #{correspondencia.id}
          </Typography>
          <Chip
            label={estadoLabels[correspondencia.estado] || correspondencia.estado}
            color={estadoColors[correspondencia.estado]}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {(isAdmin() || isOficial()) && isPendienteSinDerivaciones && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<DerivacionIcon />}
              onClick={handleDerivarAlcalde}
            >
              Derivar a Alcalde
            </Button>
          )}
          {isAlcalde() && correspondencia?.estado === 'derivada_alcaldia' && (
            <Button
              variant="contained"
              startIcon={<DerivacionIcon />}
              onClick={handleDerivarFuncionario}
            >
              Derivar a Funcionario
            </Button>
          )}
          {(isAdmin() || isOficial()) && correspondencia.estado === 'pendiente' && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/correspondencia/${id}/editar`)}
            >
              Editar
            </Button>
          )}
          {isFuncionario && derivacionPendienteParaUsuario && (
            <Button
              variant="contained"
              color="success"
              startIcon={recibirLoading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
              onClick={handleMarcarRecibida}
              disabled={recibirLoading}
            >
              {recibirLoading ? 'Procesando...' : 'Marcar como Recibida'}
            </Button>
          )}
        </Box>
      </Box>

      {isPendienteSinDerivaciones && (isAdmin() || isOficial()) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Esta correspondencia aún no ha sido derivada. Debe derivarla al Alcalde para continuar el flujo.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Información principal */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información General
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Número de Documento
                  </Typography>
                  <Typography>{correspondencia.numero_documento || 'Sin número'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Remitente
                  </Typography>
                  <Typography>{correspondencia.remitente}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Fecha del Documento
                  </Typography>
                  <Typography>
                    {correspondencia.fecha_documento
                      ? format(new Date(correspondencia.fecha_documento), 'dd/MM/yyyy', { locale: es })
                      : 'No especificada'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Fecha de Recibo
                  </Typography>
                  <Typography>
                    {correspondencia.fecha_recibo
                      ? format(new Date(correspondencia.fecha_recibo), 'dd/MM/yyyy', { locale: es })
                      : 'No especificada'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Departamento
                  </Typography>
                  <Typography>{correspondencia.departamento?.nombre || 'Sin asignar'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Descripción
                  </Typography>
                  <Typography>{correspondencia.descripcion || 'Sin descripción'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Panel lateral */}
        <Grid item xs={12} md={4}>
          {/* Providencia */}
          {correspondencia.providencia_generada && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <PdfIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'success.main' }} />
                  Providencia
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  startIcon={<PdfIcon />}
                  onClick={handleVerProvidencia}
                >
                  Ver Providencia
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Adjuntos */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <AttachIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Adjuntos
              </Typography>
              {correspondencia.adjuntos && correspondencia.adjuntos.length > 0 ? (
                <List dense>
                  {correspondencia.adjuntos.map((adj) => (
                    <ListItem
                      key={adj.id}
                      disablePadding
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          title="Descargar"
                          onClick={() => handleDescargarAdjunto(adj)}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemButton onClick={() => handleVerAdjunto(adj)}>
                        <ListItemIcon>
                          <PdfIcon color="error" />
                        </ListItemIcon>
                        <ListItemText
                          primary={adj.nombre_archivo}
                          secondary={adj.tamanio_bytes ? `${(adj.tamanio_bytes / 1024).toFixed(0)} KB` : undefined}
                        />
                        <ViewIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin adjuntos
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Historial de derivaciones */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Derivaciones
              </Typography>
              {correspondencia.derivaciones && correspondencia.derivaciones.length > 0 ? (
                <List dense>
                  {correspondencia.derivaciones.map((der) => (
                    <ListItem key={der.id}>
                      <ListItemText
                        primary={`${der.departamento_origen?.nombre} → ${der.departamento_destino?.nombre}`}
                        secondary={format(new Date(der.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      />
                      <Chip
                        label={der.estado}
                        size="small"
                        color={der.estado === 'recibido' ? 'success' : 'warning'}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin derivaciones
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog derivación */}
      <DerivacionDialog
        open={derivDialogOpen}
        onClose={() => setDerivDialogOpen(false)}
        correspondenciaId={correspondencia.id}
        prefillDepartamentoId={alcaldeInfo?.departamento_id}
        prefillUsuarioId={alcaldeInfo?.user_id}
        readOnly={derivDialogReadOnly}
        mode={derivDialogMode}
        onSuccess={handleDerivacionSuccess}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        message={snackbar.message}
      />

      {/* Dialog visor de PDF */}
      <Dialog
        open={viewerOpen}
        onClose={handleCloseViewer}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '90vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PdfIcon color="error" />
            <Typography variant="h6" noWrap sx={{ maxWidth: 500 }}>{viewerName}</Typography>
          </Box>
          <IconButton onClick={handleCloseViewer}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {viewerLoading ? (
            <CircularProgress />
          ) : viewerUrl ? (
            <iframe
              src={viewerUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={viewerName}
            />
          ) : (
            <Typography color="error">Error al cargar el documento</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseViewer}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CorrespondenciaDetail
