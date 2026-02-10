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
import { Expediente, Documento } from '../../types'
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

interface SortableDocItemProps {
  doc: any
  onClick: () => void
}

const SortableDocItem = ({ doc, onClick }: SortableDocItemProps) => {
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
        secondary={format(new Date(doc.created_at), 'dd/MM/yyyy', { locale: es })}
      />
      <Chip
        label={doc.estado || 'pendiente'}
        size="small"
        color={doc.estado === 'firmado' ? 'success' : 'default'}
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

  // Documentos ordenados localmente
  const [orderedDocs, setOrderedDocs] = useState<any[]>([])

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
        {puedeEditar && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {!estaCerrado ? (
              <Button
                variant="outlined"
                startIcon={<CerrarIcon />}
                onClick={handleCerrar}
              >
                Cerrar
              </Button>
            ) : (
              <Button
                variant="outlined"
                startIcon={<ReabrirIcon />}
                onClick={handleReabrir}
              >
                Reabrir
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/expedientes/${id}/editar`)}
            >
              Editar
            </Button>
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

          {/* Actividades */}
          {expediente.actividades && expediente.actividades.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Historial de Actividades
                </Typography>
                <List dense>
                  {expediente.actividades.slice(0, 5).map((act: any) => (
                    <ListItem key={act.id}>
                      <ListItemText
                        primary={act.descripcion}
                        secondary={`${act.usuario?.nombre || 'Sistema'} - ${format(
                          new Date(act.created_at),
                          'dd/MM/yyyy HH:mm',
                          { locale: es }
                        )}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
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
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <ListItemAvatar>
                  <DocIcon color="action" />
                </ListItemAvatar>
                <ListItemText
                  primary={option.titulo}
                  secondary={`${option.identificador} - ${option.estado}`}
                />
              </li>
            )}
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
