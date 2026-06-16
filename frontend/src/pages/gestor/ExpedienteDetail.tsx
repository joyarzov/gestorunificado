import { useState, useEffect, useRef, useMemo } from 'react'
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
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Description as DocIcon,
  Add as AddIcon,
  Lock as CerrarIcon,
  LockOpen as ReabrirIcon,
  NoteAdd as NoteAddIcon,
  Link as LinkIcon,
  UploadFile as UploadIcon,
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
import { expedientesAPI, documentosAPI } from '../../api/gestor'
import { usersAPI } from '../../api/common'
import { Expediente, Documento, User } from '../../types'

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
  incorporado: 'Incorporado',
}

interface SortableDocItemProps {
  doc: any
  onClick: () => void
  onFirmar?: () => void
}

const SortableDocItem = ({ doc, onClick, onFirmar }: SortableDocItemProps) => {
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

  // Dialog: Subir PDF
  const [openSubir, setOpenSubir] = useState(false)
  const [pdfTitulo, setPdfTitulo] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [subirLoading, setSubirLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dialog: Derivar expediente
  const [openDerivar, setOpenDerivar] = useState(false)
  const [funcionarios, setFuncionarios] = useState<User[]>([])
  const [destino, setDestino] = useState<User | null>(null)
  const [derivObservaciones, setDerivObservaciones] = useState('')
  const [derivAcciones, setDerivAcciones] = useState<string[]>([])
  const [derivarLoading, setDerivarLoading] = useState(false)
  const [recibirLoading, setRecibirLoading] = useState(false)

  // Documentos ordenados localmente
  const [orderedDocs, setOrderedDocs] = useState<any[]>([])

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
  }, [openDerivar, funcionarios.length])

  const handleDerivar = async () => {
    if (!id || !destino) return
    setDerivarLoading(true)
    try {
      await expedientesAPI.derivar(parseInt(id), {
        usuario_destino_id: destino.id,
        observaciones: derivObservaciones.trim() || undefined,
        acciones_para: derivAcciones.length > 0 ? derivAcciones : undefined,
      })
      setSnackbar({ open: true, message: `Expediente derivado a ${destino.nombre}`, severity: 'success' })
      setOpenDerivar(false)
      setDestino(null)
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

  // --- Subir PDF ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPdfFile(file)
      if (!pdfTitulo) {
        setPdfTitulo(file.name.replace(/\.pdf$/i, ''))
      }
    }
  }

  const handleSubir = async () => {
    if (!id || !pdfFile || !pdfTitulo.trim()) return
    setSubirLoading(true)
    try {
      await expedientesAPI.subirDocumento(parseInt(id), pdfFile, pdfTitulo.trim())
      setSnackbar({ open: true, message: 'Documento subido exitosamente', severity: 'success' })
      setOpenSubir(false)
      setPdfFile(null)
      setPdfTitulo('')
      loadExpediente(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al subir documento'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setSubirLoading(false)
    }
  }

  const estaCerrado = expediente?.estado === 'cerrado' || expediente?.estado === 'archivado'
  const esCreador = expediente?.creado_por === user?.id
  const esAdmin = user?.roles?.includes('admin')
  const puedeEditar = esCreador || esAdmin

  const responsableActualId = expediente?.responsable_actual_usuario_id ?? null
  const tengoElExpediente = responsableActualId != null && responsableActualId === user?.id
  const sinResponsable = responsableActualId == null
  const puedeDerivar = !estaCerrado && (
    esAdmin || tengoElExpediente ||
    (sinResponsable && (esCreador || expediente?.departamento_id === user?.departamento_id))
  )
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
  const debeRecibir = !!ultimaDeriv && ultimaDeriv.estado === 'pendiente' && (
    ultimaDeriv.usuario_destino_id === user?.id ||
    (ultimaDeriv.usuario_destino_id == null && ultimaDeriv.departamento_destino_id === user?.departamento_id)
  )

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
                    Responsable actual
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
                {puedeEditar && (
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
                  <MenuItem onClick={() => { handleMenuClose(); navigate(`/documentos/nuevo?expediente_id=${id}`) }}>
                    <ListItemIcon><NoteAddIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Crear nuevo documento</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => { handleMenuClose(); setOpenAsociar(true) }}>
                    <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Asociar documento existente</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => { handleMenuClose(); setOpenSubir(true) }}>
                    <ListItemIcon><UploadIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Subir archivo PDF</ListItemText>
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

      {/* Dialog: Subir documento PDF */}
      <Dialog open={openSubir} onClose={() => setOpenSubir(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Subir Documento PDF</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Sube un archivo PDF para asociarlo a este expediente.
          </Typography>
          <TextField
            label="Título del documento"
            value={pdfTitulo}
            onChange={(e) => setPdfTitulo(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
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
              startIcon={<UploadIcon />}
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
            disabled={!pdfFile || !pdfTitulo.trim() || subirLoading}
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
            El expediente {expediente.identificador} viajará con todos sus documentos al funcionario que elijas.
          </Typography>
          <Autocomplete
            options={funcionarios}
            getOptionLabel={(o) => `${o.nombre}${o.departamento?.nombre ? ` · ${o.departamento.nombre}` : ''}`}
            value={destino}
            onChange={(_, v) => setDestino(v)}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            renderInput={(params) => (
              <TextField {...params} label="Derivar a (funcionario responsable)" required autoFocus margin="dense" />
            )}
          />
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
            disabled={!destino || derivarLoading}
          >
            {derivarLoading ? 'Derivando...' : 'Derivar'}
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
