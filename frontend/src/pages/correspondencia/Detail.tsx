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
  TextField,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  AttachFile as AttachIcon,
  Send as DerivacionIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  PictureAsPdf as PdfIcon,
  CheckCircle as CheckCircleIcon,
  Reply as ReplyIcon,
  Archive as ArchivarIcon,
  Unarchive as DesarchivarIcon,
} from '@mui/icons-material'
import { correspondenciaAPI, AlcaldeInfo } from '../../api/correspondencia'
import { documentosAPI } from '../../api/gestor'
import { Correspondencia, Adjunto, Documento } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import DerivacionDialog from '../../components/correspondencia/DerivacionDialog'
import ConversacionHilo from '../../components/correspondencia/ConversacionHilo'
import FirmaGobModal, { FirmaParams } from '../../components/correspondencia/FirmaGobModal'
import ResumenGestion from '../../components/correspondencia/ResumenGestion'
import Snackbar from '@mui/material/Snackbar'

import { estadoCorrespondencia, TIPOS_DOCUMENTO_SALIDA } from '../../utils/estadoCorrespondencia'

const CorrespondenciaDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, actuandoComo, isAdmin, isOficial, isAlcalde } = useAuth()
  // Departamento "institucional": el del subrogado cuando hay actuando-como, el propio si no.
  const ctxDepartamentoId = actuandoComo?.departamento_id ?? user?.departamento_id
  // Id del contexto institucional (subrogado si actúa como; el propio si no).
  // Espeja al backend (User::contexto()->id), usado para validar el creador de una salida.
  const ctxUserId = actuandoComo?.id ?? user?.id

  // Quién puede subir/anular el PDF de una respuesta: Partes/admin o quien reservó
  // el folio. Espeja validarSalida(creadorOPartes) del backend para no mostrar
  // acciones que el servidor rechazaría con 403.
  const puedeGestionarSalida = (r: Correspondencia) =>
    isAdmin() || isOficial() || r.usuario_id === ctxUserId
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

  // Cierre / reapertura del proceso (solo Alcalde)
  const [archivoLoading, setArchivoLoading] = useState(false)

  const handleArchivar = async () => {
    if (!correspondencia || !window.confirm(
      `¿Cerrar el proceso de ${correspondencia.folio || 'esta correspondencia'}? Quedará archivada y de solo lectura (solo el Alcalde puede desarchivarla).`
    )) return
    setArchivoLoading(true)
    try {
      const res = await correspondenciaAPI.archivarCorrespondencia(correspondencia.id)
      setSnackbar({ open: true, message: res.message || 'Proceso cerrado' })
      if (id) loadCorrespondencia(parseInt(id))
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'No se pudo cerrar el proceso' })
    } finally {
      setArchivoLoading(false)
    }
  }

  const handleDesarchivar = async () => {
    if (!correspondencia) return
    setArchivoLoading(true)
    try {
      const res = await correspondenciaAPI.desarchivarCorrespondencia(correspondencia.id)
      setSnackbar({ open: true, message: res.message || 'Proceso reabierto' })
      if (id) loadCorrespondencia(parseInt(id))
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'No se pudo desarchivar' })
    } finally {
      setArchivoLoading(false)
    }
  }

  // Preparar respuesta (reserva de número de salida vinculada)
  const [respuestaOpen, setRespuestaOpen] = useState(false)
  const [respuestaForm, setRespuestaForm] = useState({ tipo_documento: 'oficio', materia: '', numero: '' })
  const [respuestaSerie, setRespuestaSerie] = useState<{ prefijo: string; anio: number } | null>(null)
  const [respuestaLoading, setRespuestaLoading] = useState(false)

  // Sugiere el siguiente correlativo de la serie y pre-llena el número (editable).
  const cargarSiguienteNumeroResp = async (tipo: string) => {
    try {
      const res = await correspondenciaAPI.salidaSiguienteNumero(tipo)
      setRespuestaForm((f) => ({ ...f, numero: String(res.data.numero) }))
      setRespuestaSerie({ prefijo: res.data.prefijo, anio: res.data.anio })
    } catch {
      setRespuestaSerie(null)
    }
  }

  const abrirRespuesta = () => {
    setRespuestaForm({ tipo_documento: 'oficio', materia: '', numero: '' })
    setRespuestaSerie(null)
    setRespuestaOpen(true)
    cargarSiguienteNumeroResp('oficio')
  }

  // Folio previsualizado a partir del número manual (mismo formato que el backend).
  const respuestaFolioPreview = respuestaSerie && respuestaForm.numero
    ? `${respuestaSerie.prefijo}-${respuestaSerie.anio}-${String(respuestaForm.numero).padStart(5, '0')}`
    : ''

  const handlePrepararRespuesta = async () => {
    if (!correspondencia) return
    setRespuestaLoading(true)
    try {
      const res = await correspondenciaAPI.salidaReservar({
        tipo_documento: respuestaForm.tipo_documento,
        materia: respuestaForm.materia.trim(),
        destinatario: correspondencia.remitente,
        respuesta_a_id: correspondencia.id,
        numero: respuestaForm.numero ? parseInt(respuestaForm.numero, 10) : undefined,
      })
      setRespuestaOpen(false)
      setRespuestaForm({ tipo_documento: 'oficio', materia: '', numero: '' })
      setSnackbar({ open: true, message: res.message || `Número reservado: ${res.data.folio}` })
      if (id) loadCorrespondencia(parseInt(id))
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'No se pudo reservar el número' })
    } finally {
      setRespuestaLoading(false)
    }
  }

  // Subir/asociar documento de una respuesta (reserva del alcalde → cola de Partes).
  // Dos modos: 'pdf' = subir un PDF externo; 'cero_papel' = asociar un documento
  // de Cero Papel ya firmado.
  const [subirRespuesta, setSubirRespuesta] = useState<Correspondencia | null>(null)
  const [subirRespModo, setSubirRespModo] = useState<'pdf' | 'cero_papel'>('pdf')
  const [subirRespForm, setSubirRespForm] = useState({ destinatario: '', firmante: '' })
  const [subirRespArchivo, setSubirRespArchivo] = useState<File | null>(null)
  const [subirRespLoading, setSubirRespLoading] = useState(false)
  const subirRespFileRef = useRef<HTMLInputElement>(null)
  // Documentos de Cero Papel firmados disponibles para asociar
  const [docsCeroPapel, setDocsCeroPapel] = useState<Documento[]>([])
  const [docCeroPapel, setDocCeroPapel] = useState<Documento | null>(null)
  const [docsLoading, setDocsLoading] = useState(false)

  const abrirSubirRespuesta = (r: Correspondencia) => {
    setSubirRespuesta(r)
    setSubirRespModo('pdf')
    setSubirRespForm({
      destinatario: r.remitente !== 'Por definir' ? r.remitente : (correspondencia?.remitente || ''),
      firmante: r.firmante_nombre || (user ? `${user.nombre}${user.cargo ? ', ' + user.cargo : ''}` : ''),
    })
    setSubirRespArchivo(null)
    setDocCeroPapel(null)
    // Cargar documentos firmados de Cero Papel para la opción de asociar.
    setDocsLoading(true)
    documentosAPI
      .listar({ estado: 'firmado', per_page: 50 })
      .then((res) => setDocsCeroPapel(res.data.data))
      .catch(() => setDocsCeroPapel([]))
      .finally(() => setDocsLoading(false))
  }

  const handleSubirRespuesta = async () => {
    if (!subirRespuesta) return
    if (subirRespModo === 'pdf' && !subirRespArchivo) return
    if (subirRespModo === 'cero_papel' && !docCeroPapel) return
    setSubirRespLoading(true)
    try {
      const res = subirRespModo === 'pdf'
        ? await correspondenciaAPI.salidaSubirDocumento(
            subirRespuesta.id, subirRespArchivo!, subirRespForm.destinatario, subirRespForm.firmante,
          )
        : await correspondenciaAPI.salidaAsociarDocumento(
            subirRespuesta.id, docCeroPapel!.id, subirRespForm.destinatario, subirRespForm.firmante || undefined,
          )
      setSubirRespuesta(null)
      setSnackbar({ open: true, message: res.message || 'Documento enviado a despacho' })
      if (id) loadCorrespondencia(parseInt(id))
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'No se pudo enviar el documento' })
    } finally {
      setSubirRespLoading(false)
    }
  }

  // Anular una reserva propia (folio queda en acta con motivo, no se reutiliza)
  const [anularTarget, setAnularTarget] = useState<Correspondencia | null>(null)
  const [anularMotivo, setAnularMotivo] = useState('')
  const [anularLoading, setAnularLoading] = useState(false)

  const handleAnularRespuesta = async () => {
    if (!anularTarget || !anularMotivo.trim()) return
    setAnularLoading(true)
    try {
      const res = await correspondenciaAPI.salidaAnular(anularTarget.id, anularMotivo.trim())
      setAnularTarget(null)
      setAnularMotivo('')
      setSnackbar({ open: true, message: res.message || 'Folio anulado' })
      if (id) loadCorrespondencia(parseInt(id))
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'No se pudo anular' })
    } finally {
      setAnularLoading(false)
    }
  }

  const handleDescargarRespuesta = async (r: Correspondencia) => {
    try {
      const blob = await correspondenciaAPI.salidaDescargarDocumento(r.id)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${r.folio}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setSnackbar({ open: true, message: 'No se pudo descargar el documento' })
    }
  }

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
            {correspondencia.folio || `Correspondencia #${correspondencia.id}`}
          </Typography>
          <Chip
            label={estadoCorrespondencia(correspondencia.estado).label}
            color={estadoCorrespondencia(correspondencia.estado).color}
          />
          {correspondencia.respondida_at && (
            <Chip
              label={`Respondida${correspondencia.respuestas?.find((r) => r.estado === 'despachada')?.folio ? ' · ' + correspondencia.respuestas.find((r) => r.estado === 'despachada')!.folio : ''}`}
              color="success"
              variant="outlined"
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: { xs: 'wrap', md: 'nowrap' }, '& .MuiButton-root': { whiteSpace: 'nowrap' } }}>
          {/* Cierre del proceso: solo el Alcalde, cuando ya fue recibida por
              los destinatarios. Desarchivar reabre el proceso. */}
          {isAlcalde() && correspondencia.estado === 'completada' && (
            <Button
              variant="contained"
              color="inherit"
              sx={{ bgcolor: '#4D4D4D', color: '#fff', '&:hover': { bgcolor: '#333' } }}
              startIcon={archivoLoading ? <CircularProgress size={18} color="inherit" /> : <ArchivarIcon />}
              onClick={handleArchivar}
              disabled={archivoLoading}
            >
              Cerrar proceso
            </Button>
          )}
          {isAlcalde() && correspondencia.estado === 'archivado' && (
            <Button
              variant="outlined"
              startIcon={archivoLoading ? <CircularProgress size={18} /> : <DesarchivarIcon />}
              onClick={handleDesarchivar}
              disabled={archivoLoading}
            >
              Desarchivar
            </Button>
          )}
          {/* Preparar respuesta: Partes/admin siempre (post-ingreso); el Alcalde
              solo cuando ya existe la providencia (derivó o marcó recibida).
              Nunca sobre un proceso cerrado. */}
          {correspondencia.estado !== 'archivado'
            && ((isAdmin() || isOficial()) && correspondencia.estado !== 'pendiente'
            || (isAlcalde() && !!correspondencia.providencia_generada)) && (
            <Button
              variant="outlined"
              startIcon={<ReplyIcon />}
              onClick={abrirRespuesta}
            >
              Preparar respuesta
            </Button>
          )}
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

      <Box sx={{ mb: 2 }}>
        <ResumenGestion correspondencia={correspondencia} variant="detalle" />
      </Box>

      {isPendienteSinDerivaciones && (isAdmin() || isOficial()) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Esta correspondencia aún no ha sido derivada. Debe derivarla al Alcalde para continuar el flujo.
        </Alert>
      )}

      {correspondencia.estado === 'archivado' && (
        <Alert severity="info" icon={<ArchivarIcon />} sx={{ mb: 2 }}>
          <strong>Proceso cerrado.</strong> Esta correspondencia fue archivada
          {correspondencia.archivada_at ? ` el ${format(new Date(correspondencia.archivada_at), 'dd/MM/yyyy HH:mm', { locale: es })}` : ''} y
          es de solo lectura: no admite mensajes, derivaciones ni respuestas. Solo el Alcalde puede desarchivarla.
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

          {/* Conversación: timeline unificado (derivaciones + mensajes) */}
          <Box sx={{ mt: { xs: 2, md: 3 } }}>
            <ConversacionHilo correspondenciaId={correspondencia.id} />
          </Box>
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

          {/* Respuestas (salidas vinculadas) */}
          {correspondencia.respuestas && correspondencia.respuestas.length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <ReplyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Respuestas
                </Typography>
                <List dense>
                  {correspondencia.respuestas.map((r) => (
                    <ListItem
                      key={r.id}
                      disablePadding
                      sx={{ py: 0.5 }}
                      secondaryAction={
                        ((r.estado === 'reservada' || r.estado === 'devuelta') && puedeGestionarSalida(r)) ? (
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            <Button size="small" variant="outlined" onClick={() => abrirSubirRespuesta(r)}>
                              Subir PDF
                            </Button>
                            <IconButton size="small" color="error" title="Anular folio" onClick={() => setAnularTarget(r)}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : r.estado === 'despachada' || r.estado === 'por_despachar' ? (
                          <IconButton size="small" title="Descargar documento" onClick={() => handleDescargarRespuesta(r)}>
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        ) : undefined
                      }
                    >
                      <ListItemText
                        primary={<strong>{r.folio}</strong>}
                        secondary={
                          <Chip
                            size="small"
                            label={estadoCorrespondencia(r.estado).label}
                            color={estadoCorrespondencia(r.estado).color}
                            sx={{ height: 20, fontSize: 11, mt: 0.25 }}
                          />
                        }
                      />
                    </ListItem>
                  ))}
                </List>
                <Typography variant="caption" color="text.secondary">
                  El despacho al destinatario lo realiza Oficina de Partes.
                </Typography>
              </CardContent>
            </Card>
          )}

        </Grid>
      </Grid>

      {/* Dialog: preparar respuesta (reserva número de salida vinculada) */}
      <Dialog open={respuestaOpen} onClose={() => setRespuestaOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Preparar respuesta · {correspondencia.folio || `#${correspondencia.id}`}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="info">
              Se reservará el número de la serie elegida. Redacta y firma el documento con ese número,
              y luego sube el PDF firmado desde el menú <strong>Salidas</strong> para su despacho.
            </Alert>
            <TextField
              select
              fullWidth
              label="Tipo de documento"
              value={respuestaForm.tipo_documento}
              onChange={(e) => {
                const tipo = e.target.value
                setRespuestaForm({ ...respuestaForm, tipo_documento: tipo })
                cargarSiguienteNumeroResp(tipo)
              }}
            >
              {Object.entries(TIPOS_DOCUMENTO_SALIDA).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              required
              type="number"
              label="Número"
              value={respuestaForm.numero}
              onChange={(e) => setRespuestaForm({ ...respuestaForm, numero: e.target.value })}
              helperText={
                respuestaFolioPreview
                  ? `Folio: ${respuestaFolioPreview}. Cero Papel aún no está integrado, indica el número manualmente.`
                  : 'Indica el número del documento (Cero Papel aún no está integrado).'
              }
              inputProps={{ min: 1 }}
            />
            <TextField
              fullWidth
              required
              label="Materia"
              value={respuestaForm.materia}
              onChange={(e) => setRespuestaForm({ ...respuestaForm, materia: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRespuestaOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handlePrepararRespuesta}
            disabled={respuestaLoading || !respuestaForm.materia.trim() || !respuestaForm.numero}
          >
            {respuestaLoading ? <CircularProgress size={20} /> : 'Reservar número'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: anular folio reservado */}
      <Dialog open={!!anularTarget} onClose={() => setAnularTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Anular folio · {anularTarget?.folio}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
            El folio quedará anulado con su motivo en acta y no se reutilizará. Si luego
            necesitas responder, se reservará un número nuevo.
          </Alert>
          <TextField
            fullWidth
            required
            multiline
            minRows={2}
            label="Motivo de la anulación"
            value={anularMotivo}
            onChange={(e) => setAnularMotivo(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAnularTarget(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleAnularRespuesta} disabled={anularLoading || !anularMotivo.trim()}>
            {anularLoading ? <CircularProgress size={20} /> : 'Anular folio'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: subir PDF firmado de la respuesta → cola de despacho de Partes */}
      <Dialog open={!!subirRespuesta} onClose={() => setSubirRespuesta(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Subir documento firmado · {subirRespuesta?.folio}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {subirRespuesta?.estado === 'devuelta' && subirRespuesta?.motivo_devolucion && (
              <Alert severity="warning">Devuelta por Oficina de Partes: {subirRespuesta.motivo_devolucion}</Alert>
            )}
            <Alert severity="info">
              Al enviar, el documento queda en la cola de <strong>Oficina de Partes</strong> para su despacho al destinatario.
            </Alert>
            <ToggleButtonGroup
              size="small"
              exclusive
              color="primary"
              value={subirRespModo}
              onChange={(_, v) => { if (v) setSubirRespModo(v) }}
              sx={{ alignSelf: 'flex-start' }}
            >
              <ToggleButton value="pdf">Subir PDF externo</ToggleButton>
              <ToggleButton value="cero_papel">Documento Cero Papel</ToggleButton>
            </ToggleButtonGroup>

            {subirRespModo === 'pdf' ? (
              <>
                <input
                  ref={subirRespFileRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => setSubirRespArchivo(e.target.files?.[0] ?? null)}
                />
                <Button variant="outlined" startIcon={<AttachIcon />} onClick={() => subirRespFileRef.current?.click()}>
                  {subirRespArchivo ? subirRespArchivo.name : 'Seleccionar PDF firmado'}
                </Button>
              </>
            ) : (
              <Autocomplete
                options={docsCeroPapel}
                loading={docsLoading}
                value={docCeroPapel}
                onChange={(_, v) => {
                  setDocCeroPapel(v)
                  // Prellenar el firmante con el creador del documento si está vacío.
                  if (v && !subirRespForm.firmante && v.creador?.nombre) {
                    setSubirRespForm((f) => ({ ...f, firmante: v.creador!.nombre }))
                  }
                }}
                getOptionLabel={(opt) => `${opt.numero || opt.identificador} · ${opt.titulo}`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                noOptionsText={docsLoading ? 'Cargando…' : 'No hay documentos firmados'}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Documento de Cero Papel (firmado)"
                    helperText="Solo aparecen documentos en estado firmado"
                  />
                )}
              />
            )}
            <TextField
              fullWidth
              required
              label="Destinatario externo"
              value={subirRespForm.destinatario}
              onChange={(e) => setSubirRespForm({ ...subirRespForm, destinatario: e.target.value })}
            />
            <TextField
              fullWidth
              required
              label="Firmante del documento"
              value={subirRespForm.firmante}
              onChange={(e) => setSubirRespForm({ ...subirRespForm, firmante: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubirRespuesta(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSubirRespuesta}
            disabled={subirRespLoading || !subirRespArchivo || !subirRespForm.destinatario.trim() || !subirRespForm.firmante.trim()}
          >
            {subirRespLoading ? <CircularProgress size={20} /> : 'Enviar a despacho'}
          </Button>
        </DialogActions>
      </Dialog>

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
