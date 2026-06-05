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
import FirmaGobModal, { FirmaParams } from '../../components/correspondencia/FirmaGobModal'
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
  archivado: 'Archivada',
}

const CorrespondenciaDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, actuandoComo, isAdmin, isOficial, isAlcalde } = useAuth()
  // Departamento "institucional": el del subrogado cuando hay actuando-como, el propio si no.
  const ctxDepartamentoId = actuandoComo?.departamento_id ?? user?.departamento_id
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

  // FirmaGob modal (para Alcalde al marcar como recibida)
  const [firmaModalOpen, setFirmaModalOpen] = useState(false)
  const [firmaLoading, setFirmaLoading] = useState(false)
  const [firmaError, setFirmaError] = useState<string | null>(null)
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewToken, setPreviewToken] = useState<string | null>(null)

  // Diálogo de éxito con providencia descargable
  const [acuseDialogOpen, setAcuseDialogOpen] = useState(false)
  const [acuseDerivacionId, setAcuseDerivacionId] = useState<number | null>(null)
  const [acuseLoading, setAcuseLoading] = useState(false)

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

  useEffect(() => {
    return () => {
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl)
    }
  }, [previewPdfUrl])

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
        (d) => d.estado === 'pendiente' && d.departamento_destino_id === ctxDepartamentoId
      )
    : undefined

  // Derivación pendiente para el alcalde (cuando recibe desde Oficina de Partes)
  const derivacionPendienteParaAlcalde = isAlcalde() && correspondencia?.estado === 'derivada_alcaldia'
    ? correspondencia.derivaciones?.find(
        (d) => d.estado === 'pendiente' && d.departamento_destino_id === ctxDepartamentoId
      )
    : undefined

  const handleMarcarRecibida = async () => {
    const derivacion = derivacionPendienteParaUsuario || derivacionPendienteParaAlcalde
    if (!derivacion) return

    if (isAlcalde()) {
      // El Alcalde debe firmar con FirmaGob — primero generar la vista previa de la providencia
      setFirmaError(null)
      setRecibirLoading(true)
      try {
        const { blob, token } = await correspondenciaAPI.previewRecibir(derivacion.id)
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        setPreviewPdfUrl(url)
        setPreviewToken(token)
        setFirmaModalOpen(true)
      } catch (err: any) {
        setFirmaError(err?.response?.data?.message || 'No se pudo generar la vista previa de la providencia.')
        setFirmaModalOpen(true)
      } finally {
        setRecibirLoading(false)
      }
      return
    }

    // Funcionario: marcar directamente sin firma
    setRecibirLoading(true)
    try {
      await correspondenciaAPI.recibirDerivacion(derivacion.id)
      setSnackbar({ open: true, message: 'Correspondencia marcada como recibida' })
      if (id) loadCorrespondencia(parseInt(id))
    } catch (err) {
      console.error('Error al marcar como recibida:', err)
      setSnackbar({ open: true, message: 'Error al marcar como recibida' })
    } finally {
      setRecibirLoading(false)
    }
  }

  const revokePreview = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl)
    }
    setPreviewPdfUrl(null)
    setPreviewToken(null)
  }

  const handleFirmarRecepcion = async ({ otp, firmaY, firmaPage, firmaCol }: FirmaParams) => {
    const derivacion = derivacionPendienteParaAlcalde
    if (!derivacion) return
    setFirmaLoading(true)
    setFirmaError(null)
    try {
      await correspondenciaAPI.recibirDerivacion(
        derivacion.id,
        otp,
        firmaY,
        firmaPage,
        firmaCol,
        previewToken ?? undefined,
      )
      setFirmaModalOpen(false)
      revokePreview()
      setAcuseDerivacionId(derivacion.id)
      setAcuseDialogOpen(true)
      if (id) loadCorrespondencia(parseInt(id))
    } catch (err: any) {
      setFirmaError(err?.response?.data?.message || 'Error al firmar. Verifique el código OTP e intente nuevamente.')
    } finally {
      setFirmaLoading(false)
    }
  }

  const handleVerAcuse = async () => {
    if (!acuseDerivacionId) return
    setAcuseLoading(true)
    try {
      const blob = await correspondenciaAPI.descargarPdfDerivacion(acuseDerivacionId)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch {
      setSnackbar({ open: true, message: 'Error al descargar la providencia' })
    } finally {
      setAcuseLoading(false)
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
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
            <>
              <Button
                variant="contained"
                startIcon={<DerivacionIcon />}
                onClick={handleDerivarFuncionario}
              >
                Derivar a Funcionario
              </Button>
              {derivacionPendienteParaAlcalde && (
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
            </>
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

      <Grid container spacing={{ xs: 2, md: 3 }}>
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
                    <ListItem key={der.id} alignItems="flex-start">
                      <ListItemText
                        primary={`${der.departamento_origen?.nombre ?? '—'} → ${der.departamento_destino?.nombre ?? '—'}`}
                        secondaryTypographyProps={{ component: 'div' }}
                        secondary={
                          <Box component="span" sx={{ display: 'block' }}>
                            {(der.usuario_origen?.nombre || der.usuario_destino?.nombre) && (
                              <Box component="span" sx={{ display: 'block', color: 'text.primary' }}>
                                {der.usuario_origen?.nombre && (
                                  <>De: {der.usuario_origen.nombre}
                                    {der.actuando_como?.nombre ? ` (por ${der.actuando_como.nombre})` : ''}</>
                                )}
                                {der.usuario_origen?.nombre && der.usuario_destino?.nombre && '  ·  '}
                                {der.usuario_destino?.nombre && <>Para: {der.usuario_destino.nombre}</>}
                              </Box>
                            )}
                            <Box component="span" sx={{ display: 'block' }}>
                              {format(new Date(der.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </Box>
                          </Box>
                        }
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

      {/* Modal FirmaGob para Alcalde al marcar como recibida */}
      <FirmaGobModal
        open={firmaModalOpen}
        titulo="Firmar Providencia con FirmaGob"
        descripcion="Se generará una Providencia (dirigida a Alcaldía) firmada electrónicamente. Seleccione la posición del sello e ingrese su OTP para completar la recepción."
        loading={firmaLoading}
        error={firmaError}
        pdfUrl={previewPdfUrl}
        onFirmar={handleFirmarRecepcion}
        onCancel={() => {
          setFirmaModalOpen(false)
          setFirmaError(null)
          revokePreview()
        }}
      />

      {/* Diálogo de éxito: providencia firmada */}
      <Dialog open={acuseDialogOpen} onClose={() => setAcuseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" />
          Recepción completada
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main', mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              Correspondencia marcada como recibida
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Se generó y firmó la Providencia electrónicamente.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={acuseLoading ? <CircularProgress size={18} /> : <PdfIcon />}
              onClick={handleVerAcuse}
              disabled={acuseLoading}
            >
              Ver Providencia PDF
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setAcuseDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CorrespondenciaDetail
