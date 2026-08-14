import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Stack,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  ListItemAvatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Snackbar,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  RemoveCircleOutline as QuitarIcon,
  Edit as EditIcon,
  Description as DocIcon,
  Add as AddIcon,
  Lock as CerrarIcon,
  LockOpen as ReabrirIcon,
  NoteAdd as NoteAddIcon,
  Link as LinkIcon,
  UploadFile as UploadIcon,
  AttachFile as AnexoIcon,
  DragIndicator as DragIcon,
  Send as DerivarIcon,
  MoveToInbox as RecibirIcon,
  Person as PersonIcon,
  Draw as FirmarIcon,
} from '@mui/icons-material'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { expedientesAPI, documentosAPI, tiposDocumentalesAPI } from '../../api/gestor'
import { usersAPI, departamentosAPI } from '../../api/common'
import { Expediente, Documento, User, TipoDocumental, Departamento } from '../../types'

const ACCIONES_DERIVACION = ['Tomar conocimiento', 'Informar', 'Tramitar', 'Revisar', 'Visar bueno', 'Archivar']
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'

const estadoColors: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
  borrador: 'default',
  en_tramite: 'info',
  cerrado: 'warning',
  archivado: 'default',
}

const estadoLabels: Record<string, string> = {
  borrador: 'Borrador',
  en_tramite: 'En Trámite',
  cerrado: 'Cerrado',
  archivado: 'Archivado',
}

const nivelAccesoLabels: Record<number, string> = {
  1: 'Público',
  2: 'Restringido',
  3: 'Reservado',
  4: 'Secreto',
}

// Estados de documento (distintos de los del expediente)
const docEstadoColor: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  borrador: 'default',
  pendiente_firma: 'warning',
  firmado: 'success',
  rechazado: 'error',
  anulado: 'error',
  incorporado: 'info',
}
const docEstadoLabel: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_firma: 'Pendiente de firma',
  firmado: 'Firmado',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
  // Un PDF que entró como antecedente: se archiva tal cual, sin pasar por firma.
  incorporado: 'Antecedente',
}

interface SortableDocItemProps {
  doc: any
  onClick: () => void
  onFirmar?: () => void
  /** Solo mientras el expediente se está armando (borrador). */
  onQuitar?: () => void
}

const SortableDocItem = ({ doc, onClick, onFirmar, onQuitar }: SortableDocItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      sx={{ cursor: 'pointer' }}
    >
      <ListItemIcon
        {...attributes}
        {...listeners}
        sx={{ cursor: 'grab', minWidth: 32 }}
      >
        <DragIcon fontSize="small" color="action" />
      </ListItemIcon>
      <ListItemIcon onClick={onClick}>
        <DocIcon />
      </ListItemIcon>
      <ListItemText
        onClick={onClick}
        primary={doc.titulo}
        secondary={format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
      />
      {doc.mi_firma_pendiente && (
        <Button
          size="small"
          variant="contained"
          color="warning"
          startIcon={<FirmarIcon />}
          onClick={onFirmar}
          sx={{ mr: 1 }}
        >
          Firmar
        </Button>
      )}
      <Chip
        label={doc.mi_firma_pendiente ? 'Pendiente de tu firma' : (docEstadoLabel[doc.estado] || doc.estado || 'Pendiente')}
        size="small"
        color={doc.mi_firma_pendiente ? 'warning' : (docEstadoColor[doc.estado] || 'default')}
        variant={doc.mi_firma_pendiente ? 'outlined' : 'filled'}
      />
      {onQuitar && (
        <Tooltip title="Quitar del expediente">
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onQuitar() }}
            sx={{ ml: 1 }}
            aria-label={`Quitar ${doc.titulo} del expediente`}
          >
            <QuitarIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </ListItem>
  )
}

const ExpedienteDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [expediente, setExpediente] = useState<Expediente | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Menu "Agregar Documento"
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)

  // Dialog: Asociar documento existente
  const [openAsociar, setOpenAsociar] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [docOptions, setDocOptions] = useState<Documento[]>([])
  const [docSearchLoading, setDocSearchLoading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null)
  const [asociarLoading, setAsociarLoading] = useState(false)

  // Dialog: adjuntar antecedente (PDF que se archiva tal cual, sin firma)
  const [openSubir, setOpenSubir] = useState(false)
  const [pdfTitulo, setPdfTitulo] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfTipoId, setPdfTipoId] = useState<number | ''>('')
  const [tiposDocumentales, setTiposDocumentales] = useState<TipoDocumental[]>([])
  const [subirLoading, setSubirLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dialog: Derivar expediente
  const [openDerivar, setOpenDerivar] = useState(false)
  const [funcionarios, setFuncionarios] = useState<User[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [destinos, setDestinos] = useState<User[]>([])
  const [deptosDestino, setDeptosDestino] = useState<Departamento[]>([])
  const [derivObservaciones, setDerivObservaciones] = useState('')
  const [derivAcciones, setDerivAcciones] = useState<string[]>([])
  const [derivarLoading, setDerivarLoading] = useState(false)
  const [recibirLoading, setRecibirLoading] = useState(false)

  // Documentos ordenados localmente
  const [orderedDocs, setOrderedDocs] = useState<any[]>([])

  // Quitar un documento del expediente (solo mientras es borrador)
  const [docAQuitar, setDocAQuitar] = useState<any | null>(null)
  const [quitarLoading, setQuitarLoading] = useState(false)

  // Hoja de ruta consolidada (actividades + firmas)
  const [hojaRuta, setHojaRuta] = useState<Array<{ fuente: string; tipo: string; descripcion: string; usuario: string; fecha: string }>>([])

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // Sync orderedDocs when expediente changes
  useEffect(() => {
    if (expediente?.documentos) {
      setOrderedDocs(expediente.documentos)
    }
  }, [expediente?.documentos])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const docIds = useMemo(() => orderedDocs.map((d: any) => d.id), [orderedDocs])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !id) return

    const oldIndex = orderedDocs.findIndex((d: any) => d.id === active.id)
    const newIndex = orderedDocs.findIndex((d: any) => d.id === over.id)
    const newOrder = arrayMove(orderedDocs, oldIndex, newIndex)
    setOrderedDocs(newOrder)

    try {
      await expedientesAPI.reordenarDocumentos(
        parseInt(id),
        newOrder.map((d: any, i: number) => ({ id: d.id, orden: i + 1 })),
      )
    } catch (err) {
      console.error('Error al reordenar:', err)
      setSnackbar({ open: true, message: 'Error al guardar el orden', severity: 'error' })
      // Revert on error
      if (expediente?.documentos) setOrderedDocs(expediente.documentos)
    }
  }

  useEffect(() => {
    if (id) {
      loadExpediente(parseInt(id))
    }
  }, [id])

  const loadExpediente = async (expId: number) => {
    setLoading(true)
    try {
      const response = await expedientesAPI.obtener(expId)
      setExpediente(response.data)
      try {
        const hr = await expedientesAPI.hojaRuta(expId)
        setHojaRuta(hr.data || [])
      } catch { /* la hoja de ruta es secundaria; no bloquea la vista */ }
    } catch (err) {
      setError('Error al cargar el expediente')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCerrar = async () => {
    if (!id) return
    try {
      await expedientesAPI.cerrar(parseInt(id))
      loadExpediente(parseInt(id))
    } catch (err) {
      console.error('Error al cerrar:', err)
    }
  }

  const handleReabrir = async () => {
    if (!id) return
    try {
      await expedientesAPI.reabrir(parseInt(id))
      loadExpediente(parseInt(id))
    } catch (err) {
      console.error('Error al reabrir:', err)
    }
  }

  // --- Derivar expediente ---
  useEffect(() => {
    if (!openDerivar || funcionarios.length > 0) return
    usersAPI.funcionarios()
      .then((res) => setFuncionarios(res.data || []))
      .catch(() => setSnackbar({ open: true, message: 'No se pudieron cargar los funcionarios', severity: 'error' }))
    departamentosAPI.listar()
      .then((res) => setDepartamentos(res.data || []))
      .catch(() => { /* los departamentos son opcionales: se puede derivar solo a funcionarios */ })
  }, [openDerivar, funcionarios.length])

  // Un funcionario cuyo departamento se deriva completo ya viene incluido ahí; el
  // backend descarta su fila nominal, así que lo avisamos antes de enviar.
  const destinosCubiertos = useMemo(() => {
    const ids = deptosDestino.map((d) => d.id)
    return destinos.filter((u) => u.departamento_id && ids.includes(u.departamento_id)).map((u) => u.nombre)
  }, [destinos, deptosDestino])

  const handleDerivar = async () => {
    if (!id || (destinos.length === 0 && deptosDestino.length === 0)) return
    setDerivarLoading(true)
    try {
      const res = await expedientesAPI.derivar(parseInt(id), {
        usuario_destino_ids: destinos.length > 0 ? destinos.map((u) => u.id) : undefined,
        departamento_destino_ids: deptosDestino.length > 0 ? deptosDestino.map((d) => d.id) : undefined,
        observaciones: derivObservaciones.trim() || undefined,
        acciones_para: derivAcciones.length > 0 ? derivAcciones : undefined,
      })
      setSnackbar({ open: true, message: res.message || 'Expediente derivado', severity: 'success' })
      setOpenDerivar(false)
      setDestinos([])
      setDeptosDestino([])
      setDerivObservaciones('')
      setDerivAcciones([])
      loadExpediente(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al derivar el expediente'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setDerivarLoading(false)
    }
  }

  const handleQuitarDocumento = async () => {
    if (!id || !docAQuitar) return
    setQuitarLoading(true)
    try {
      await expedientesAPI.quitarDocumento(parseInt(id), docAQuitar.id)
      setSnackbar({
        open: true,
        message: `"${docAQuitar.titulo}" salió del expediente y sigue en Mis documentos`,
        severity: 'success',
      })
      setDocAQuitar(null)
      loadExpediente(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al quitar el documento'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setQuitarLoading(false)
    }
  }

  const handleRecibir = async () => {
    if (!id) return
    setRecibirLoading(true)
    try {
      await expedientesAPI.recibir(parseInt(id))
      setSnackbar({ open: true, message: 'Expediente recibido', severity: 'success' })
      loadExpediente(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al recibir el expediente'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setRecibirLoading(false)
    }
  }

  // --- Menu Agregar Documento ---
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget)
  }
  const handleMenuClose = () => {
    setMenuAnchor(null)
  }

  // --- Asociar documento existente ---
  useEffect(() => {
    if (!openAsociar) return
    const timer = setTimeout(async () => {
      if (docSearch.length < 2) {
        setDocOptions([])
        return
      }
      setDocSearchLoading(true)
      try {
        const res = await documentosAPI.listar({ search: docSearch, per_page: 20 })
        const asociadosIds = new Set(expediente?.documentos?.map((d: any) => d.id) || [])
        const filtered = (res.data?.data || []).filter((d: Documento) => !asociadosIds.has(d.id))
        setDocOptions(filtered)
      } catch {
        setDocOptions([])
      } finally {
        setDocSearchLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [docSearch, openAsociar])

  const handleAsociar = async () => {
    if (!id || !selectedDoc) return
    setAsociarLoading(true)
    try {
      await expedientesAPI.asociarDocumento(parseInt(id), selectedDoc.id)
      setSnackbar({ open: true, message: 'Documento asociado exitosamente', severity: 'success' })
      setOpenAsociar(false)
      setSelectedDoc(null)
      setDocSearch('')
      loadExpediente(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al asociar documento'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setAsociarLoading(false)
    }
  }

  // --- Adjuntar antecedente (PDF que se archiva tal cual, sin firma) ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPdfFile(file)
      if (!pdfTitulo) {
        setPdfTitulo(file.name.replace(/\.pdf$/i, ''))
      }
    }
  }

  // Cargar tipos documentales al abrir el diálogo de subir PDF
  useEffect(() => {
    if (!openSubir || tiposDocumentales.length > 0) return
    tiposDocumentalesAPI.listar()
      .then(res => setTiposDocumentales(res.data || []))
      .catch(() => setSnackbar({ open: true, message: 'No se pudieron cargar los tipos de documento', severity: 'error' }))
  }, [openSubir, tiposDocumentales.length])

  const handleSubir = async () => {
    if (!id || !pdfFile || !pdfTitulo.trim() || !pdfTipoId) return
    setSubirLoading(true)
    try {
      await expedientesAPI.subirDocumento(parseInt(id), pdfFile, pdfTitulo.trim(), Number(pdfTipoId))
      setSnackbar({ open: true, message: 'Antecedente adjuntado al expediente', severity: 'success' })
      setOpenSubir(false)
      setPdfFile(null)
      setPdfTitulo('')
      setPdfTipoId('')
      loadExpediente(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al adjuntar el antecedente'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setSubirLoading(false)
    }
  }

  const estaCerrado = expediente?.estado === 'cerrado' || expediente?.estado === 'archivado'
  const esCreador = expediente?.creado_por === user?.id
  const esAdmin = user?.roles?.includes('admin')
  const puedeEditar = esCreador || esAdmin

  // El backend decide quién puede derivar y quién debe acusar recibo: con varios
  // destinatarios a la vez la última derivación ya no alcanza para deducirlo.
  const puedeDerivar = expediente?.puedo_derivar ?? false

  // Aportar documentos es más amplio que gestionar: quien tramita el expediente
  // adjunta sus respaldos sin devolvérselo al creador. Editarlo, en cambio —
  // asociar documentos ajenos, cerrarlo—, sigue siendo del creador.
  const puedeAportar = puedeEditar || puedeDerivar

  // Quitar documentos solo mientras se arma el expediente: una vez derivado ya
  // circuló con ese contenido (mismo criterio que aplica el backend).
  const puedeQuitarDocs = expediente?.estado === 'borrador' && puedeEditar
  const eventoIcono = (tipo: string) => {
    switch (tipo) {
      case 'documento_firmado': return <FirmarIcon fontSize="small" color="success" />
      case 'documento_rechazado': return <FirmarIcon fontSize="small" color="error" />
      case 'derivacion': return <DerivarIcon fontSize="small" color="info" />
      case 'recepcion': return <RecibirIcon fontSize="small" color="primary" />
      case 'cierre': return <CerrarIcon fontSize="small" color="warning" />
      case 'reapertura': return <ReabrirIcon fontSize="small" color="action" />
      default: return <DocIcon fontSize="small" color="action" />
    }
  }

  const ultimaDeriv = expediente?.ultima_derivacion
  const debeRecibir = expediente?.mi_derivacion_pendiente ?? false

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error || !expediente) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Volver
        </Button>
        <Alert severity="error">{error || 'Expediente no encontrado'}</Alert>
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
            {expediente.identificador}
          </Typography>
          <Chip
            label={estadoLabels[expediente.estado] || expediente.estado}
            color={estadoColors[expediente.estado] || 'default'}
          />
        </Box>
        {(puedeEditar || puedeDerivar || debeRecibir) && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {debeRecibir && (
              <Button
                variant="contained"
                color="success"
                startIcon={<RecibirIcon />}
                onClick={handleRecibir}
                disabled={recibirLoading}
              >
                Recibir
              </Button>
            )}
            {puedeDerivar && (
              <Button
                variant="contained"
                startIcon={<DerivarIcon />}
                onClick={() => setOpenDerivar(true)}
              >
                Derivar
              </Button>
            )}
            {puedeEditar && !estaCerrado && (
              <Button
                variant="outlined"
                startIcon={<CerrarIcon />}
                onClick={handleCerrar}
              >
                Cerrar
              </Button>
            )}
            {puedeEditar && estaCerrado && (
              <Button
                variant="outlined"
                startIcon={<ReabrirIcon />}
                onClick={handleReabrir}
              >
                Reabrir
              </Button>
            )}
            {puedeEditar && !estaCerrado && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/expedientes/${id}/editar`)}
              >
                Editar
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información del Expediente
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Título
                  </Typography>
                  <Typography fontWeight="medium">{expediente.titulo}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Asunto
                  </Typography>
                  <Typography>{expediente.asunto || '-'}</Typography>
                </Grid>
                {expediente.resumen && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Resumen
                    </Typography>
                    <Typography>{expediente.resumen}</Typography>
                  </Grid>
                )}
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Nivel de Acceso
                  </Typography>
                  <Typography>
                    <Chip
                      label={nivelAccesoLabels[expediente.nivel_acceso ?? 1] || 'Público'}
                      size="small"
                      variant="outlined"
                    />
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Departamento
                  </Typography>
                  <Typography>{expediente.departamento?.nombre || 'Sin asignar'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    {(expediente.tenedores?.length ?? 0) > 1 ? 'En poder de' : 'Responsable actual'}
                  </Typography>
                  {expediente.responsable_actual ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PersonIcon fontSize="small" color="action" />
                      <Typography>
                        {expediente.responsable_actual.nombre}
                        {expediente.responsable_actual_departamento?.nombre
                          ? ` · ${expediente.responsable_actual_departamento.nombre}`
                          : ''}
                      </Typography>
                      {ultimaDeriv?.estado === 'pendiente' && (
                        <Chip label="Por recibir" size="small" color="warning" variant="outlined" sx={{ ml: 0.5 }} />
                      )}
                    </Box>
                  ) : expediente.tenedores && expediente.tenedores.length > 0 ? (
                    // Derivado a varios: la responsabilidad vive en las derivaciones,
                    // no en un responsable único.
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      {expediente.tenedores.map((t) => (
                        <Chip key={t} icon={<PersonIcon />} label={t} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  ) : (
                    <Typography color="text.secondary">Sin derivar</Typography>
                  )}
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Fecha de Creación
                  </Typography>
                  <Typography>
                    {expediente.fecha_creacion
                      ? format(new Date(expediente.fecha_creacion), 'dd/MM/yyyy HH:mm', { locale: es })
                      : '-'}
                  </Typography>
                </Grid>
                {expediente.fecha_cierre && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Fecha de Cierre
                    </Typography>
                    <Typography>
                      {format(new Date(expediente.fecha_cierre), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </Typography>
                  </Grid>
                )}
                {expediente.cpat_codigo && (
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Código CPAT
                    </Typography>
                    <Typography>{expediente.cpat_codigo}</Typography>
                  </Grid>
                )}
                {expediente.informacion_sensible && (
                  <Grid item xs={6}>
                    <Chip label="Contiene información sensible" color="warning" size="small" />
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Documentos del Expediente
                </Typography>
                {puedeAportar && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleMenuOpen}
                    disabled={estaCerrado}
                  >
                    Agregar Documento
                  </Button>
                )}
                <Menu
                  anchorEl={menuAnchor}
                  open={Boolean(menuAnchor)}
                  onClose={handleMenuClose}
                >
                  {puedeEditar && (
                    <MenuItem onClick={() => { handleMenuClose(); navigate(`/documentos/nuevo?expediente_id=${id}`) }}>
                      <ListItemIcon><NoteAddIcon fontSize="small" /></ListItemIcon>
                      <ListItemText>Crear nuevo documento</ListItemText>
                    </MenuItem>
                  )}
                  {puedeEditar && (
                    <MenuItem onClick={() => { handleMenuClose(); setOpenAsociar(true) }}>
                      <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
                      <ListItemText>Asociar documento existente</ListItemText>
                    </MenuItem>
                  )}
                  {puedeEditar && <Divider />}
                  {/* Dos vías distintas para un PDF que ya existe fuera de la plataforma:
                      el antecedente se archiva tal cual y el documento pasa por firma.
                      Ambas quedan también para quien tramita el expediente. */}
                  <MenuItem onClick={() => { handleMenuClose(); setOpenSubir(true) }}>
                    <ListItemIcon><AnexoIcon fontSize="small" /></ListItemIcon>
                    <ListItemText
                      primary="Adjuntar antecedente"
                      secondary="Respaldo que no se firma: cotización, certificado, correo"
                    />
                  </MenuItem>
                  <MenuItem onClick={() => { handleMenuClose(); navigate(`/documentos/subir?expediente_id=${id}`) }}>
                    <ListItemIcon><UploadIcon fontSize="small" /></ListItemIcon>
                    <ListItemText
                      primary="Subir documento a firma"
                      secondary="Memo, informe u oficio: se firma aquí o ya viene firmado"
                    />
                  </MenuItem>
                </Menu>
              </Box>
              {orderedDocs.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={docIds} strategy={verticalListSortingStrategy}>
                    <List>
                      {orderedDocs.map((doc: any) => (
                        <SortableDocItem
                          key={doc.id}
                          doc={doc}
                          onClick={() => navigate(`/documentos/${doc.id}`)}
                          onFirmar={() => navigate(`/documentos/${doc.id}`)}
                          onQuitar={puedeQuitarDocs ? () => setDocAQuitar(doc) : undefined}
                        />
                      ))}
                    </List>
                  </SortableContext>
                </DndContext>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No hay documentos asociados
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Información del Creador */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información Adicional
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Creado por
                </Typography>
                <Typography variant="body2">{expediente.creador?.nombre || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Fecha de registro
                </Typography>
                <Typography variant="body2">
                  {format(new Date(expediente.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Hoja de ruta consolidada (actividades + firmas) */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Hoja de ruta
              </Typography>
              {hojaRuta.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin movimientos registrados.
                </Typography>
              ) : (
                <List dense>
                  {hojaRuta.map((ev, i) => (
                    <ListItem key={i} alignItems="flex-start">
                      <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>{eventoIcono(ev.tipo)}</ListItemIcon>
                      <ListItemText
                        primary={ev.descripcion}
                        secondary={`${ev.usuario} · ${format(new Date(ev.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog: Asociar documento existente */}
      <Dialog open={openAsociar} onClose={() => setOpenAsociar(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Asociar Documento Existente</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Busca un documento por título o identificador para asociarlo a este expediente.
          </Typography>
          <Autocomplete
            options={docOptions}
            getOptionLabel={(option) => `${option.identificador} - ${option.titulo}`}
            loading={docSearchLoading}
            value={selectedDoc}
            onChange={(_e, value) => setSelectedDoc(value)}
            onInputChange={(_e, value) => setDocSearch(value)}
            renderOption={(props, option) => {
              const { key, ...liProps } = props as { key?: React.Key } & Record<string, unknown>
              const doc = option as any
              return (
                <li key={option.id} {...liProps} style={{ alignItems: 'flex-start' }}>
                  <ListItemAvatar sx={{ minWidth: 40, mt: 0.5 }}>
                    <DocIcon color="action" />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight="medium" component="span">
                          {doc.titulo}
                        </Typography>
                        <Chip
                          label={docEstadoLabel[doc.estado] || doc.estado}
                          size="small"
                          color={docEstadoColor[doc.estado] || 'default'}
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <>
                        {doc.identificador}
                        {doc.numero ? ` · Nº ${doc.numero}` : ''}
                        {doc.tipo_documental?.nombre ? ` · ${doc.tipo_documental.nombre}` : ''}
                        <br />
                        {doc.creador?.nombre ? `Creado por ${doc.creador.nombre}` : 'Creado por —'}
                        {doc.created_at ? ` · ${format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: es })}` : ''}
                      </>
                    }
                    secondaryTypographyProps={{ component: 'span' }}
                  />
                </li>
              )
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Buscar documento"
                placeholder="Escribe al menos 2 caracteres..."
                fullWidth
                autoFocus
              />
            )}
            noOptionsText={docSearch.length < 2 ? 'Escribe para buscar...' : 'No se encontraron documentos'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAsociar(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleAsociar}
            disabled={!selectedDoc || asociarLoading}
          >
            {asociarLoading ? <CircularProgress size={20} /> : 'Asociar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: adjuntar antecedente (no requiere firma) */}
      <Dialog open={openSubir} onClose={() => setOpenSubir(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adjuntar antecedente</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Para respaldos que se archivan tal como llegaron: cotizaciones, certificados,
            correos, planos. Quedan incorporados al expediente sin pasar por firma.
          </Typography>
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={
              <Button
                size="small"
                onClick={() => { setOpenSubir(false); navigate(`/documentos/subir?expediente_id=${id}`) }}
              >
                Ir allá
              </Button>
            }
          >
            ¿Es un memo, informe u oficio que se firma? Usa "Subir documento a firma".
          </Alert>
          <TextField
            label="Título del antecedente"
            value={pdfTitulo}
            onChange={(e) => setPdfTitulo(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            select
            required
            label="Tipo de documento"
            value={pdfTipoId}
            onChange={(e) => setPdfTipoId(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
            sx={{ mb: 2 }}
            helperText="Selecciona el tipo documental"
          >
            {tiposDocumentales.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>
            ))}
          </TextField>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<AnexoIcon />}
              onClick={() => fileInputRef.current?.click()}
            >
              Seleccionar PDF
            </Button>
            {pdfFile && (
              <Chip
                label={pdfFile.name}
                onDelete={() => setPdfFile(null)}
                size="small"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSubir(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSubir}
            disabled={!pdfFile || !pdfTitulo.trim() || !pdfTipoId || subirLoading}
          >
            {subirLoading ? <CircularProgress size={20} /> : 'Subir'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Derivar expediente */}
      <Dialog open={openDerivar} onClose={() => setOpenDerivar(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Derivar expediente</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            El expediente {expediente.identificador} viajará con todos sus documentos a cada destino que elijas.
            Puedes combinar funcionarios y departamentos completos; cada uno acusa recibo por separado.
          </Typography>
          <Autocomplete
            multiple
            options={funcionarios}
            getOptionLabel={(o) => `${o.nombre}${o.departamento?.nombre ? ` · ${o.departamento.nombre}` : ''}`}
            value={destinos}
            onChange={(_, v) => setDestinos(v)}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={(params) => (
              <TextField {...params} label="Funcionarios" autoFocus margin="dense" />
            )}
          />
          <Autocomplete
            multiple
            options={departamentos}
            getOptionLabel={(o) => o.nombre}
            value={deptosDestino}
            onChange={(_, v) => setDeptosDestino(v)}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={(params) => (
              <TextField {...params} label="Departamentos completos (opcional)" margin="dense" />
            )}
            sx={{ mt: 1 }}
          />
          {destinosCubiertos.length > 0 && (
            <Alert severity="info" sx={{ mt: 1.5 }}>
              {destinosCubiertos.join(', ')} {destinosCubiertos.length === 1 ? 'ya está incluido' : 'ya están incluidos'} en
              el departamento que derivas completo, así que no recibirá una copia aparte.
            </Alert>
          )}
          <Autocomplete
            multiple
            options={ACCIONES_DERIVACION}
            value={derivAcciones}
            onChange={(_, v) => setDerivAcciones(v)}
            renderInput={(params) => (
              <TextField {...params} label="Acciones para el destinatario (opcional)" margin="dense" />
            )}
            sx={{ mt: 1 }}
          />
          <TextField
            label="Observaciones / providencia (opcional)"
            value={derivObservaciones}
            onChange={(e) => setDerivObservaciones(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            margin="dense"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDerivar(false)}>Cancelar</Button>
          <Button
            variant="contained"
            startIcon={<DerivarIcon />}
            onClick={handleDerivar}
            disabled={(destinos.length === 0 && deptosDestino.length === 0) || derivarLoading}
          >
            {derivarLoading ? 'Derivando...' : 'Derivar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: quitar documento del expediente */}
      <Dialog open={!!docAQuitar} onClose={() => setDocAQuitar(null)} maxWidth="xs" fullWidth>
        <DialogTitle>¿Quitar este documento del expediente?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <strong>{docAQuitar?.titulo}</strong> saldrá de {expediente.identificador}.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            El documento no se elimina: seguirá disponible en Mis documentos y puedes volver
            a asociarlo cuando quieras.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocAQuitar(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<QuitarIcon />}
            onClick={handleQuitarDocumento}
            disabled={quitarLoading}
          >
            {quitarLoading ? 'Quitando...' : 'Quitar del expediente'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar de alertas */}
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

export default ExpedienteDetail
