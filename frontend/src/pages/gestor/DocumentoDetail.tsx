import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  MenuItem,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
  Divider,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Send as EnviarIcon,
  Create as FirmarIcon,
  CheckCircle as FirmadoIcon,
  HourglassEmpty as PendienteIcon,
  Cancel as RechazadoIcon,
  AddCircle as AddCircleIcon,
  Forward as ForwardIcon,
  MarkEmailRead as MarkEmailReadIcon,
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  Verified as VerifiedIcon,
  Download as DownloadIcon,
  Folder as FolderIcon,
} from '@mui/icons-material'
import { documentosAPI, tiposDocumentalesAPI } from '../../api/gestor'
import api from '../../api/axios'
import PdfViewer from '../../components/common/PdfViewer'
import FirmaPagePreview from '../../components/common/FirmaPagePreview'
import { usersAPI } from '../../api/common'
import { Documento, DocumentoEnvio, DocumentoFirma, DocumentoTrazabilidad, TipoDocumental, User } from '../../types'

const NIVELES_ACCESO = [
  { value: 1, label: 'Público' },
  { value: 2, label: 'Restringido' },
  { value: 3, label: 'Reservado' },
  { value: 4, label: 'Secreto' },
]
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'

const estadoColors: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  borrador: 'default',
  pendiente_firma: 'warning',
  firmado: 'success',
  rechazado: 'error',
  anulado: 'error',
  incorporado: 'info',
}

const estadoLabels: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_firma: 'Pendiente de Firma',
  firmado: 'Firmado',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
  incorporado: 'Incorporado',
}

const envioEstadoLabels: Record<string, string> = {
  enviado: 'Enviado',
  completado: 'Completado',
}

const envioEstadoColors: Record<string, 'info' | 'success'> = {
  enviado: 'info',
  completado: 'success',
}

const trazabilidadIconMap: Record<string, { icon: React.ReactElement; color: string }> = {
  creado: { icon: <AddCircleIcon />, color: '#4caf50' },
  editado: { icon: <EditIcon />, color: '#2196f3' },
  enviado_a_firma: { icon: <EnviarIcon />, color: '#ff9800' },
  firmado: { icon: <FirmadoIcon />, color: '#4caf50' },
  firma_rechazada: { icon: <RechazadoIcon />, color: '#f44336' },
  enviado: { icon: <ForwardIcon />, color: '#2196f3' },
  recibido: { icon: <MarkEmailReadIcon />, color: '#4caf50' },
  firmante_agregado: { icon: <PersonAddIcon />, color: '#2196f3' },
  eliminado: { icon: <DeleteIcon />, color: '#f44336' },
  incorporado: { icon: <FolderIcon />, color: '#4caf50' },
  asociado: { icon: <FolderIcon />, color: '#2196f3' },
}

const accionLabels: Record<string, string> = {
  creado: 'Creado',
  editado: 'Editado',
  enviado_a_firma: 'Enviado a firma',
  firmado: 'Firmado',
  firma_rechazada: 'Firma rechazada',
  enviado: 'Enviado',
  recibido: 'Recibido',
  firmante_agregado: 'Firmante agregado',
  eliminado: 'Eliminado',
  incorporado: 'Incorporado',
  asociado: 'Asociado a expediente',
}

// Tramos de "Altura del sello": el slider salta SOLO a estas posiciones (no es fluido),
// alineadas a la grilla de apilado (cada 80pt desde y=20). Así, firmas de distintas
// personas en el mismo documento que elijan el mismo tramo quedan en la MISMA línea.
const ALTURA_TRAMOS = [20, 100, 180, 260, 340, 420, 500, 580, 660].map(
  (y) => ((y - 10) / 702) * 100,
)

const DocumentoDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [documento, setDocumento] = useState<Documento | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [envios, setEnvios] = useState<DocumentoEnvio[]>([])
  const [trazabilidad, setTrazabilidad] = useState<DocumentoTrazabilidad[]>([])
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  // Editar metadatos (documentos subidos/externos)
  const [openEditMeta, setOpenEditMeta] = useState(false)
  const [editTitulo, setEditTitulo] = useState('')
  const [editTipoId, setEditTipoId] = useState<number | ''>('')
  const [editNivel, setEditNivel] = useState(1)
  const [editLoading, setEditLoading] = useState(false)
  const [tiposDocumentales, setTiposDocumentales] = useState<TipoDocumental[]>([])
  const [enviarDialogOpen, setEnviarDialogOpen] = useState(false)
  const [funcionarios, setFuncionarios] = useState<User[]>([])
  const [selectedDestinatarios, setSelectedDestinatarios] = useState<User[]>([])
  const [firmarDialogOpen, setFirmarDialogOpen] = useState(false)
  const [rechazarDialogOpen, setRechazarDialogOpen] = useState(false)
  const [rechazoMotivo, setRechazoMotivo] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [firmaGobEnabled, setFirmaGobEnabled] = useState(false)
  const [firmaGobPurpose, setFirmaGobPurpose] = useState('')
  const [firmaYPos, setFirmaYPos] = useState(ALTURA_TRAMOS[0])  // arranca en el tramo más bajo
  const [firmaPageMode, setFirmaPageMode] = useState<'LAST' | 'FIRST' | 'NUM'>('LAST')
  const [firmaPageNum, setFirmaPageNum] = useState(1)
  const [firmaCol, setFirmaCol] = useState(0)             // columna: 0=izq, 1=centro, 2=der
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // Responsive document preview scaling
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [docScale, setDocScale] = useState(1)

  const updateScale = useCallback(() => {
    if (previewContainerRef.current) {
      const containerWidth = previewContainerRef.current.clientWidth - 32 // padding
      const docWidth = 794
      const scale = Math.min(1, containerWidth / docWidth)
      setDocScale(scale)
    }
  }, [])

  useEffect(() => {
    updateScale()
    const observer = new ResizeObserver(updateScale)
    if (previewContainerRef.current) {
      observer.observe(previewContainerRef.current)
    }
    return () => observer.disconnect()
  }, [updateScale])

  useEffect(() => {
    if (id) {
      loadDocumento(parseInt(id))
    }
  }, [id])

  useEffect(() => {
    documentosAPI.firmaConfig()
      .then(r => {
        setFirmaGobEnabled(r.data?.firma_gob_enabled ?? false)
        setFirmaGobPurpose(r.data?.firma_gob_purpose ?? '')
      })
      .catch(() => {})
  }, [])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  // Miniatura real del sello del firmante para la vista previa
  const [selloUrl, setSelloUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!firmarDialogOpen) return
    let url: string | null = null
    api.get('/firma-sellos/mi-sello', { responseType: 'blob' })
      .then((res) => {
        url = URL.createObjectURL(res.data as Blob)
        setSelloUrl(url)
      })
      .catch(() => setSelloUrl(null))
    return () => {
      if (url) URL.revokeObjectURL(url)
      setSelloUrl(null)
    }
  }, [firmarDialogOpen])

  // Auto-select next available column when firma dialog opens
  useEffect(() => {
    if (firmarDialogOpen) {
      const existingCount = (documento?.firmas || []).filter(f => f.estado === 'firmado' && f.firma_gob_data).length
      setFirmaCol(existingCount % 3)
    }
  }, [firmarDialogOpen, pdfUrl])

  const loadDocumento = async (docId: number) => {
    setLoading(true)
    try {
      const response = await documentosAPI.obtener(docId)
      setDocumento(response.data)
      // Cargar envíos si el documento está firmado
      if (response.data.estado === 'firmado') {
        try {
          const enviosRes = await documentosAPI.enviosDocumento(docId)
          setEnvios(enviosRes.data)
        } catch {
          // No es crítico si falla
        }
      }
      // Cargar PDF para vista previa (firmado, pendiente_firma o cualquier estado con contenido)
      const necesitaPdf = response.data.archivo_pdf || response.data.contenido_html
      if (necesitaPdf) {
        try {
          const blob = await documentosAPI.descargar(docId)
          if (blob instanceof Blob && blob.type === 'application/pdf') {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl)
            setPdfUrl(URL.createObjectURL(blob))
          }
        } catch {
          // Fallback a HTML si falla la carga del PDF
        }
      }
      // Cargar trazabilidad
      try {
        const trazRes = await documentosAPI.trazabilidad(docId)
        setTrazabilidad(trazRes.data)
      } catch {
        // No es crítico si falla
      }
    } catch (err) {
      setError('Error al cargar el documento')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDescargar = async () => {
    if (!id) return
    try {
      const blob = await documentosAPI.descargar(parseInt(id))
      const url = URL.createObjectURL(blob as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${documento?.numero || documento?.identificador || 'documento'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setSnackbar({ open: true, message: 'Error al descargar el documento', severity: 'error' })
    }
  }

  const handleEnviarAFirma = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await documentosAPI.enviarAFirma(parseInt(id))
      setSnackbar({ open: true, message: 'Documento enviado a firma', severity: 'success' })
      loadDocumento(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al enviar a firma'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleFirmar = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      const firmaY = Math.round(10 + (firmaYPos / 100) * 702)
      // FirmaGob solo acepta "LAST" o número de página (no "FIRST")
      const firmaPage = firmaPageMode === 'LAST' ? 'LAST' : firmaPageMode === 'FIRST' ? '1' : String(firmaPageNum)
      await documentosAPI.firmar(parseInt(id), undefined, otpCode || undefined, firmaY, firmaPage, firmaCol)
      setSnackbar({ open: true, message: 'Documento firmado exitosamente', severity: 'success' })
      setOtpCode('')
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al firmar'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setActionLoading(false)
      loadDocumento(parseInt(id))
    }
  }

  const handleRechazar = async () => {
    if (!id || !rechazoMotivo.trim()) return
    setActionLoading(true)
    try {
      await documentosAPI.rechazarFirma(parseInt(id), rechazoMotivo.trim())
      setSnackbar({ open: true, message: 'Firma rechazada', severity: 'success' })
      setRechazarDialogOpen(false)
      setRechazoMotivo('')
      loadDocumento(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al rechazar firma'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDevolverABorrador = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await documentosAPI.devolverABorrador(parseInt(id))
      setSnackbar({ open: true, message: 'Documento devuelto a borrador. Ya puedes corregirlo.', severity: 'success' })
      navigate(`/documentos/${id}/editar`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al devolver a borrador'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleEnviarDocumento = async (destinatarioIds?: number[]) => {
    if (!id) return
    setActionLoading(true)
    try {
      await documentosAPI.enviarDocumento(parseInt(id), destinatarioIds)
      setSnackbar({ open: true, message: 'Documento enviado correctamente', severity: 'success' })
      setEnviarDialogOpen(false)
      setSelectedDestinatarios([])
      loadDocumento(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al enviar documento'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleClickEnviar = async () => {
    // Si el documento tiene destinatario preestablecido (memo), enviar directo
    const tieneDestinatarioPreset = documento?.contenido_json?.['_destinatario_id'] || documento?.contenido_json?.['para']
    if (tieneDestinatarioPreset) {
      handleEnviarDocumento()
    } else {
      // Para decretos y otros: abrir diálogo de selección
      if (funcionarios.length === 0) {
        try {
          const res = await usersAPI.funcionarios()
          setFuncionarios(res.data)
        } catch {
          // fallback silencioso
        }
      }
      setEnviarDialogOpen(true)
    }
  }

  const handleEnviarConDestinatarios = () => {
    if (selectedDestinatarios.length === 0) return
    const ids = selectedDestinatarios.map(u => u.id)
    handleEnviarDocumento(ids)
  }

  // Determinar si el usuario actual puede firmar:
  // - Documento en estado pendiente_firma
  // - Usuario está en firmantes_asignados O es firmante_asignado_id
  // - Usuario no ha firmado ya (no tiene firma con estado 'firmado')
  const getFirmaDelUsuario = (firmas: DocumentoFirma[], userId: number) => {
    return firmas?.find(f => (f.usuario_id === userId || f.firmante_id === userId) && f.estado === 'firmado')
  }

  const esAsignado = documento?.firmantes_asignados?.some(u => u.id === user?.id) ||
    documento?.firmante_asignado_id === user?.id

  const yaFirmo = user ? !!getFirmaDelUsuario(documento?.firmas || [], user.id) : false

  const puedeEnviarAFirma = documento?.estado === 'borrador' &&
    ((documento?.firmantes_asignados && documento.firmantes_asignados.length > 0) || documento?.firmante_asignado_id)

  // Firma secuencial: solo puede firmar quien tiene el turno.
  const esMiTurno = documento?.firmante_en_turno_id != null && documento.firmante_en_turno_id === user?.id
  const puedeFirmar = documento?.estado === 'pendiente_firma' && esAsignado && !yaFirmo && esMiTurno
  // Es firmante y no ha firmado, pero aún no es su turno (espera a los anteriores).
  const esperaSuTurno = documento?.estado === 'pendiente_firma' && esAsignado && !yaFirmo && !esMiTurno

  // Recuperación de un documento rechazado: el creador (o admin) puede corregirlo
  const esCreadorOAdmin = documento?.creado_por === user?.id || !!user?.roles?.includes('admin')
  const firmaRechazo = (documento?.firmas || []).filter(f => f.estado === 'rechazado').slice(-1)[0]
  const motivoRechazo = firmaRechazo?.observacion || firmaRechazo?.observaciones || ''
  const puedeCorregir = documento?.estado === 'rechazado' && esCreadorOAdmin

  // Documento subido/externo: no tiene plantilla ni contenido editable; sus datos se editan
  // por metadatos (título, tipo, nivel) en vez del editor de plantilla.
  const esSubido = !!documento && !documento.plantilla
  const puedeEditarMetadatos = esSubido && esCreadorOAdmin &&
    documento?.estado !== 'firmado' && documento?.estado !== 'anulado'

  const abrirEditarMetadatos = () => {
    if (!documento) return
    setEditTitulo(documento.titulo || '')
    setEditTipoId(documento.tipo_documental?.id ?? '')
    setEditNivel(documento.nivel_acceso || 1)
    if (tiposDocumentales.length === 0) {
      tiposDocumentalesAPI.listar().then(r => setTiposDocumentales(r.data || [])).catch(() => {})
    }
    setOpenEditMeta(true)
  }

  const handleGuardarMetadatos = async () => {
    if (!id || !editTitulo.trim() || !editTipoId) return
    setEditLoading(true)
    try {
      await documentosAPI.actualizarMetadatos(parseInt(id), {
        titulo: editTitulo.trim(),
        tipo_documental_id: Number(editTipoId),
        nivel_acceso: editNivel,
      })
      setSnackbar({ open: true, message: 'Documento actualizado', severity: 'success' })
      setOpenEditMeta(false)
      loadDocumento(parseInt(id))
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al actualizar el documento'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setEditLoading(false)
    }
  }

  // El creador puede enviar el documento firmado
  // Para memos: tiene destinatario preestablecido → enviar directo (solo una vez)
  // Para decretos: sin destinatario preestablecido → abrir selector de usuarios (puede enviar a múltiples)
  const tieneDestinatarioPreset = documento?.contenido_json?.['_destinatario_id'] || documento?.contenido_json?.['para']
  const yaEnviado = envios.length > 0
  const puedeEnviar = documento?.estado === 'firmado' && documento?.creado_por === user?.id &&
    (!tieneDestinatarioPreset || !yaEnviado)

  // Build the list of firmantes with their status
  const getFirmantesConEstado = () => {
    if (!documento) return []

    const firmantes: Array<{ user: User; estado: 'pendiente' | 'firmado' | 'rechazado'; fecha?: string; observacion?: string; firma_gob_id?: string }> = []

    const asignados = documento.firmantes_asignados || []
    // If no firmantes_asignados but there's firmante_asignado, use that
    if (asignados.length === 0 && documento.firmante_asignado) {
      const firma = documento.firmas?.find(f => f.usuario_id === documento.firmante_asignado_id || f.firmante_id === documento.firmante_asignado_id)
      firmantes.push({
        user: documento.firmante_asignado,
        estado: firma?.estado || 'pendiente',
        firma_gob_id: firma?.firma_gob_id,
        fecha: firma?.fecha_firma,
        observacion: firma?.observacion || firma?.observaciones,
      })
      return firmantes
    }

    for (const asignado of asignados) {
      const firma = documento.firmas?.find(f => f.usuario_id === asignado.id || f.firmante_id === asignado.id)
      firmantes.push({
        user: asignado,
        estado: firma?.estado || 'pendiente',
        firma_gob_id: firma?.firma_gob_id,
        fecha: firma?.fecha_firma,
        observacion: firma?.observacion || firma?.observaciones,
      })
    }

    return firmantes
  }

  const firmantesConEstado = documento ? getFirmantesConEstado() : []

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error || !documento) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Volver
        </Button>
        <Alert severity="error">{error || 'Documento no encontrado'}</Alert>
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
            {documento.numero || documento.identificador}
          </Typography>
          {documento.tipo_documental?.nombre && (
            <Chip
              label={documento.tipo_documental.nombre}
              color="primary"
              variant="outlined"
            />
          )}
          <Chip
            label={estadoLabels[documento.estado] || documento.estado}
            color={estadoColors[documento.estado]}
          />
          {yaEnviado && (
            <Chip
              label={envios.length === 1
                ? (envioEstadoLabels[envios[0].estado] || envios[0].estado)
                : `Enviado a ${envios.length} destinatarios`
              }
              color={envios.every(e => e.estado === 'completado') ? 'success' : 'info'}
              variant="outlined"
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {puedeEnviar && (
            <Button
              variant="contained"
              color="primary"
              startIcon={actionLoading ? <CircularProgress size={20} /> : <EnviarIcon />}
              onClick={handleClickEnviar}
              disabled={actionLoading}
            >
              Enviar
            </Button>
          )}
          {puedeEnviarAFirma && (
            <Button
              variant="outlined"
              startIcon={actionLoading ? <CircularProgress size={20} /> : <EnviarIcon />}
              onClick={handleEnviarAFirma}
              disabled={actionLoading}
            >
              Enviar a Firma
            </Button>
          )}
          {puedeFirmar && (
            <>
              <Button
                variant="contained"
                color="success"
                startIcon={<FirmarIcon />}
                onClick={() => setFirmarDialogOpen(true)}
                disabled={actionLoading}
              >
                Firmar
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setRechazarDialogOpen(true)}
                disabled={actionLoading}
              >
                Rechazar
              </Button>
            </>
          )}
          {esperaSuTurno && (
            <Chip
              icon={<PendienteIcon />}
              color="warning"
              variant="outlined"
              label="Aún no es tu turno: faltan firmas anteriores"
            />
          )}
          {/* Subido/externo: editar metadatos. Creado en borrador: editor de plantilla. */}
          {puedeEditarMetadatos ? (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={abrirEditarMetadatos}
            >
              Editar
            </Button>
          ) : (documento.estado === 'borrador' && !esSubido && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/documentos/${id}/editar`)}
            >
              Editar
            </Button>
          ))}
          {puedeCorregir && (
            <Button
              variant="contained"
              color="warning"
              startIcon={actionLoading ? <CircularProgress size={20} /> : <EditIcon />}
              onClick={handleDevolverABorrador}
              disabled={actionLoading}
            >
              Corregir y reenviar
            </Button>
          )}
        </Box>
      </Box>

      {documento.estado === 'rechazado' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>Documento rechazado.</strong>
          {motivoRechazo ? <> Motivo: «{motivoRechazo}».</> : null}
          {puedeCorregir
            ? ' Usa «Corregir y reenviar» para devolverlo a borrador, editarlo y volver a enviarlo a firma.'
            : ' El creador debe corregirlo y reenviarlo.'}
        </Alert>
      )}

      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12} md={8}>
          {/* Información del Documento */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información del Documento
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Título</Typography>
                  <Typography fontWeight="medium">{documento.titulo}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Tipo Documental</Typography>
                  <Typography>{documento.tipo_documental?.nombre}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Número</Typography>
                  <Typography>{documento.numero || 'Pendiente'}</Typography>
                </Grid>
                {documento.descripcion && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Descripción</Typography>
                    <Typography>{documento.descripcion}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Expedientes asociados (enlaces) */}
          {documento.expedientes && documento.expedientes.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {documento.expedientes.length > 1 ? 'Expedientes asociados' : 'Expediente'}
                </Typography>
                <List dense disablePadding>
                  {documento.expedientes.map((exp) => (
                    <ListItem
                      key={exp.id}
                      disableGutters
                      sx={{ cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                      onClick={() => navigate(`/expedientes/${exp.id}`)}
                      secondaryAction={<ForwardIcon color="action" fontSize="small" />}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <FolderIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${exp.identificador || exp.numero_expediente} — ${exp.titulo}`}
                        primaryTypographyProps={{ color: 'primary.main', variant: 'body2', fontWeight: 'medium' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Vista previa del contenido */}
          {(pdfUrl || documento.contenido_html) && (
            <Card sx={{ bgcolor: '#e0e0e0', mb: 3 }} ref={previewContainerRef}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="h6">
                    Contenido {pdfUrl && <Chip label="PDF" size="small" color="success" sx={{ ml: 1 }} />}
                  </Typography>
                  {pdfUrl && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={handleDescargar}
                    >
                      Descargar PDF
                    </Button>
                  )}
                </Box>
                {pdfUrl ? (
                  <PdfViewer url={pdfUrl} />
                ) : (
                  <Box
                    sx={{
                      maxHeight: '85vh',
                      overflow: 'auto',
                      pb: 2,
                    }}
                  >
                    <Box sx={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                    }}>
                      <Box
                        sx={{
                          width: 794,
                          minHeight: 1056 * docScale,
                          bgcolor: 'white',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                          p: '45px 76px 57px 94px',
                          fontFamily: 'serif',
                          fontSize: '12pt',
                          lineHeight: 1.5,
                          transform: `scale(${docScale})`,
                          transformOrigin: 'top center',
                          mb: docScale < 1 ? `${-(1 - docScale) * 1056}px` : 0,
                          '& > div': {
                            maxWidth: '100% !important',
                            padding: '0 !important',
                            margin: '0 !important',
                          },
                        }}
                        dangerouslySetInnerHTML={{ __html: documento.contenido_html || '' }}
                      />
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

        </Grid>

        <Grid item xs={12} md={4}>
          {/* Firmas */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">
                  Firmas
                </Typography>
                {documento.firmas_requeridas && (
                  <Chip
                    label={`${documento.firmas?.filter(f => f.estado === 'firmado').length || 0} / ${documento.firmas_requeridas} requeridas`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
              {firmantesConEstado.length > 0 ? (
                <List dense>
                  {firmantesConEstado.map((item) => (
                    <ListItem key={item.user.id}>
                      <ListItemIcon>
                        {item.estado === 'firmado' ? (
                          <FirmadoIcon color="success" />
                        ) : item.estado === 'rechazado' ? (
                          <RechazadoIcon color="error" />
                        ) : (
                          <PendienteIcon color="disabled" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.user.nombre}
                        secondary={
                          item.estado === 'firmado' && item.fecha
                            ? `Firmado el ${format(new Date(item.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}`
                            : item.estado === 'rechazado'
                              ? `Rechazado${item.observacion ? ': ' + item.observacion : ''}`
                              : 'Pendiente de firma'
                        }
                      />
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                        <Chip
                          label={item.estado === 'firmado' ? 'Firmado' : item.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                          size="small"
                          color={item.estado === 'firmado' ? 'success' : item.estado === 'rechazado' ? 'error' : 'default'}
                          variant="outlined"
                        />
                        {item.firma_gob_id && (
                          <Chip
                            icon={<VerifiedIcon sx={{ fontSize: 14 }} />}
                            label="FirmaGob"
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ fontSize: 11 }}
                          />
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              ) : documento.estado === 'borrador' ? (
                <Typography variant="body2" color="text.secondary">
                  {(documento.firmantes_asignados?.length || documento.firmante_asignado_id)
                    ? 'Las firmas se activarán al enviar el documento a firma'
                    : 'No hay firmantes asignados'}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No hay firmantes asignados
                </Typography>
              )}
            </CardContent>
          </Card>


          {/* Estado de Envío */}
          {(yaEnviado || puedeEnviar) && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Envío
                </Typography>
                {yaEnviado ? (
                  envios.map((envio) => (
                    <Box key={envio.id} sx={{ mb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2">
                          <strong>Para:</strong> {envio.destinatario?.nombre}
                        </Typography>
                        <Chip
                          label={envioEstadoLabels[envio.estado]}
                          color={envioEstadoColors[envio.estado]}
                          size="small"
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Enviado: {format(new Date(envio.fecha_envio), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </Typography>
                      {envio.fecha_recepcion && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Recibido: {format(new Date(envio.fecha_recepcion), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </Typography>
                      )}
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Documento listo para enviar al destinatario
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metadatos */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información Adicional
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Creado por
                </Typography>
                <Typography variant="body2">{documento.creador?.nombre}</Typography>
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Año
                </Typography>
                <Typography variant="body2">{documento.anio}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Fecha de creación
                </Typography>
                <Typography variant="body2">
                  {format(new Date(documento.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Trazabilidad */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trazabilidad
              </Typography>
              {trazabilidad.length > 0 ? (
                <List dense disablePadding>
                  {trazabilidad.map((evento, index) => {
                    const iconConfig = trazabilidadIconMap[evento.accion] || { icon: <AddCircleIcon />, color: '#9e9e9e' }
                    return (
                      <Box key={evento.id}>
                        {index > 0 && <Divider />}
                        <ListItem sx={{ px: 0, py: 1 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Box sx={{ color: iconConfig.color, display: 'flex' }}>
                              {iconConfig.icon}
                            </Box>
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {accionLabels[evento.accion] || evento.accion}
                                </Typography>
                              </Box>
                            }
                            secondary={
                              <>
                                <Typography variant="caption" component="span" display="block">
                                  {evento.descripcion}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" component="span" display="block">
                                  {evento.usuario?.nombre && `${evento.usuario.nombre} — `}
                                  {format(new Date(evento.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                                </Typography>
                              </>
                            }
                          />
                        </ListItem>
                      </Box>
                    )
                  })}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin registros de trazabilidad
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Diálogo de confirmación de firma */}
      <Dialog
        open={firmarDialogOpen}
        onClose={() => { setFirmarDialogOpen(false); setOtpCode('') }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Confirmar Firma</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Está a punto de firmar electrónicamente el documento <strong>{documento.numero || documento.identificador}</strong>.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Esta acción tiene validez legal y no puede deshacerse. Al firmar, usted certifica que ha revisado y aprueba el contenido del documento.
          </Typography>
          {firmaGobEnabled && (
            <>
              <Chip
                icon={<VerifiedIcon />}
                label="Firma Electrónica Avanzada (FirmaGob)"
                color="primary"
                size="small"
                sx={{ mb: 2 }}
              />
              {/* Selector de posición del sello */}
              {(() => {
                const existingFirmaPositions = (documento.firmas || [])
                  .filter(f => f.estado === 'firmado' && f.firma_gob_data)
                  .map(f => ({
                    col: (f.firma_gob_data as any)?.firma_col ?? 0,
                    firmaY: (f.firma_gob_data as any)?.firma_y ?? 20,
                    nombre: f.usuario?.nombre ?? '',
                  }))
                const newSlot = existingFirmaPositions.length

                return (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="medium" sx={{ mb: 1.5 }}>
                      Posición del sello de firma
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>

                      {/* Preview a la izquierda */}
                      <FirmaPagePreview
                        pdfUrl={pdfUrl}
                        firmaYPos={firmaYPos}
                        existingFirmas={existingFirmaPositions}
                        newRow={Math.floor(newSlot / 3)}
                        newCol={firmaCol}
                        selloUrl={selloUrl}
                        previewPage={firmaPageMode === 'NUM' ? firmaPageNum : firmaPageMode === 'FIRST' ? 'first' : 'last'}
                      />

                      {/* Controles a la derecha */}
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Página */}
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            Página
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <ToggleButtonGroup
                              value={firmaPageMode}
                              exclusive
                              onChange={(_, v) => v && setFirmaPageMode(v)}
                              size="small"
                            >
                              <ToggleButton value="LAST" sx={{ fontSize: 11, px: 1 }}>Última</ToggleButton>
                              <ToggleButton value="FIRST" sx={{ fontSize: 11, px: 1 }}>Pág. 1</ToggleButton>
                              <ToggleButton value="NUM" sx={{ fontSize: 11, px: 1 }}>Nro.</ToggleButton>
                            </ToggleButtonGroup>
                            {firmaPageMode === 'NUM' && (
                              <TextField
                                type="number"
                                value={firmaPageNum}
                                onChange={(e) => setFirmaPageNum(Math.max(1, parseInt(e.target.value) || 1))}
                                size="small"
                                inputProps={{ min: 1, style: { width: 48, textAlign: 'center' } }}
                              />
                            )}
                          </Box>
                        </Box>

                        {/* Altura */}
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                            Altura del sello
                          </Typography>
                          <Box sx={{ px: 1 }}>
                            <Slider
                              value={firmaYPos}
                              onChange={(_, v) => setFirmaYPos(v as number)}
                              min={0}
                              max={100}
                              step={null}
                              size="small"
                              marks={ALTURA_TRAMOS.map((value, i) => ({
                                value,
                                label:
                                  i === 0
                                    ? 'Inferior'
                                    : i === ALTURA_TRAMOS.length - 1
                                    ? 'Superior'
                                    : undefined,
                              }))}
                              sx={{ '& .MuiSlider-markLabel': { fontSize: 10 } }}
                            />
                          </Box>
                        </Box>

                        {/* Selector de columna */}
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            Posición horizontal
                          </Typography>
                          <ToggleButtonGroup
                            value={firmaCol}
                            exclusive
                            onChange={(_, v) => v !== null && setFirmaCol(v)}
                            size="small"
                          >
                            <ToggleButton value={0} sx={{ fontSize: 11, px: 1.5 }}>Izquierda</ToggleButton>
                            <ToggleButton value={1} sx={{ fontSize: 11, px: 1.5 }}>Centro</ToggleButton>
                            <ToggleButton value={2} sx={{ fontSize: 11, px: 1.5 }}>Derecha</ToggleButton>
                          </ToggleButtonGroup>
                        </Box>

                        {/* Código OTP - bajo el selector de posición */}
                        {firmaGobPurpose !== 'Desatendido' && (
                          <TextField
                            fullWidth
                            label="Código OTP (Google Authenticator)"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            size="small"
                            inputProps={{ maxLength: 10 }}
                            helperText="Abra Google Authenticator en su celular e ingrese el código de 6 dígitos."
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                )
              })()}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFirmarDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={actionLoading ? <CircularProgress size={20} /> : <FirmarIcon />}
            onClick={() => {
              setFirmarDialogOpen(false)
              handleFirmar()
            }}
            disabled={actionLoading}
          >
            Confirmar Firma
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de rechazo de firma */}
      <Dialog
        open={rechazarDialogOpen}
        onClose={() => { setRechazarDialogOpen(false); setRechazoMotivo('') }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rechazar Firma</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Indique el motivo por el cual rechaza firmar este documento.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Motivo del rechazo"
            value={rechazoMotivo}
            onChange={(e) => setRechazoMotivo(e.target.value)}
            placeholder="Describa el motivo del rechazo..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRechazarDialogOpen(false); setRechazoMotivo('') }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRechazar}
            disabled={actionLoading || !rechazoMotivo.trim()}
            startIcon={actionLoading ? <CircularProgress size={20} /> : undefined}
          >
            Rechazar Firma
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para seleccionar destinatarios (decretos y otros) */}
      <Dialog
        open={enviarDialogOpen}
        onClose={() => { setEnviarDialogOpen(false); setSelectedDestinatarios([]) }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Enviar Documento</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Seleccione los destinatarios a quienes desea enviar este documento.
          </Typography>
          <Autocomplete
            multiple
            options={funcionarios.filter(f => f.id !== user?.id && !envios.some(e => e.destinatario_id === f.id))}
            getOptionLabel={(option) => option.nombre + (option.cargo ? ` - ${option.cargo}` : '')}
            value={selectedDestinatarios}
            onChange={(_, newValue) => setSelectedDestinatarios(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Destinatarios"
                placeholder="Buscar funcionario..."
                sx={{ mt: 1 }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEnviarDialogOpen(false); setSelectedDestinatarios([]) }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={actionLoading ? <CircularProgress size={20} /> : <EnviarIcon />}
            onClick={handleEnviarConDestinatarios}
            disabled={actionLoading || selectedDestinatarios.length === 0}
          >
            Enviar a {selectedDestinatarios.length > 0 ? `${selectedDestinatarios.length} destinatario${selectedDestinatarios.length > 1 ? 's' : ''}` : '...'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Editar metadatos (documentos subidos/externos) */}
      <Dialog open={openEditMeta} onClose={() => setOpenEditMeta(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar documento</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Este es un documento subido (PDF). Puedes editar su nombre, tipo y nivel de acceso.
          </Typography>
          <TextField
            label="Nombre del documento"
            value={editTitulo}
            onChange={(e) => setEditTitulo(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <TextField
            select
            required
            label="Tipo de documento"
            value={editTipoId}
            onChange={(e) => setEditTipoId(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
            sx={{ mb: 2 }}
          >
            {tiposDocumentales.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Nivel de acceso"
            value={editNivel}
            onChange={(e) => setEditNivel(Number(e.target.value))}
            fullWidth
          >
            {NIVELES_ACCESO.map((n) => (
              <MenuItem key={n.value} value={n.value}>{n.label}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditMeta(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleGuardarMetadatos}
            disabled={!editTitulo.trim() || !editTipoId || editLoading}
          >
            {editLoading ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default DocumentoDetail
