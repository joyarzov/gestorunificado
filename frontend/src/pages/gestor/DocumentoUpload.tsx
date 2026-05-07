import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  TextField,
  MenuItem,
  Alert,
  AlertTitle,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Chip,
  Autocomplete,
  Stack,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  InputLabel,
  Select,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  ArrowBack as BackIcon,
  Description as PdfIcon,
  Verified as VerifiedIcon,
  GppMaybe as UnsignedIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Delete as DeleteIcon,
  ArrowForward as NextIcon,
} from '@mui/icons-material'
import { documentosAPI, expedientesAPI, tiposDocumentalesAPI, AnalisisUpload, AccionSubida } from '../../api/gestor'
import { usersAPI } from '../../api/common'
import { Expediente, TipoDocumental, User } from '../../types'
import { useAuth } from '../../contexts/AuthContext'

const NIVELES_ACCESO = [
  { value: 1, label: 'Público' },
  { value: 2, label: 'Restringido' },
  { value: 3, label: 'Reservado' },
  { value: 4, label: 'Secreto' },
]

const steps = ['Subir PDF', 'Metadatos', 'Acción a realizar']

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const DocumentoUpload = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeStep, setActiveStep] = useState(0)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [analizando, setAnalizando] = useState(false)
  const [analisis, setAnalisis] = useState<AnalisisUpload | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Catálogos
  const [tiposDocumentales, setTiposDocumentales] = useState<TipoDocumental[]>([])
  const [expedientes, setExpedientes] = useState<Expediente[]>([])
  const [funcionarios, setFuncionarios] = useState<User[]>([])

  // Metadatos (paso 2)
  const [titulo, setTitulo] = useState('')
  const [tipoDocumentalId, setTipoDocumentalId] = useState<number | ''>('')
  const [descripcion, setDescripcion] = useState('')
  const [palabrasClave, setPalabrasClave] = useState('')
  const [nivelAcceso, setNivelAcceso] = useState<number>(1)
  const [expedienteSel, setExpedienteSel] = useState<Expediente | null>(null)

  // Acción (paso 3)
  const [accion, setAccion] = useState<AccionSubida>('guardar_borrador')
  const [firmantesSel, setFirmantesSel] = useState<User[]>([])

  useEffect(() => {
    Promise.all([
      tiposDocumentalesAPI.listar(),
      expedientesAPI.listar({ estado: 'abierto', per_page: 100 }),
      usersAPI.funcionarios(),
    ])
      .then(([tipos, exps, funcs]) => {
        if (tipos.success) setTiposDocumentales(tipos.data.filter((t) => t.activo))
        if (exps.success) setExpedientes(exps.data.data)
        if (funcs.success) setFuncionarios(funcs.data.filter((f) => f.activo && f.id !== user?.id))
      })
      .catch(() => {})
  }, [user?.id])

  const handleArchivo = async (file: File) => {
    setError(null)
    if (file.type !== 'application/pdf') {
      setError('El archivo debe ser un PDF')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('El PDF supera los 20 MB permitidos')
      return
    }
    setArchivo(file)
    setAnalizando(true)
    try {
      const res = await documentosAPI.analizarUpload(file)
      if (res.success) {
        setAnalisis(res.data)
        // Pre-llenar título con el nombre del archivo (sin extensión)
        if (!titulo) {
          setTitulo(file.name.replace(/\.pdf$/i, ''))
        }
      } else {
        setError(res.message || 'Error al analizar el PDF')
        setArchivo(null)
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setError(err.response?.data?.message || 'Error al subir el archivo')
      setArchivo(null)
    } finally {
      setAnalizando(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleArchivo(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleArchivo(file)
  }

  const handleQuitarArchivo = () => {
    setArchivo(null)
    setAnalisis(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const puedeAvanzarPaso1 = !!analisis && !analizando
  const puedeAvanzarPaso2 = !!titulo.trim() && !!tipoDocumentalId

  const opcionesAccion: { value: AccionSubida; label: string; descripcion: string; disabled?: boolean }[] = [
    {
      value: 'cerrar_firmado',
      label: 'Registrar como ya firmado',
      descripcion: 'El PDF tiene firmas electrónicas válidas. Se guarda como documento firmado sin requerir más acciones.',
      disabled: !analisis?.has_signatures,
    },
    {
      value: 'firmar_propio',
      label: 'Firmar yo mismo',
      descripcion: 'Te asignas como firmante y vas directo a la pantalla de firma.',
    },
    {
      value: 'enviar_firma',
      label: 'Enviar a firma de otro funcionario',
      descripcion: 'Selecciona uno o más funcionarios que deben firmar el documento.',
    },
    {
      value: 'guardar_borrador',
      label: 'Guardar como borrador',
      descripcion: 'Guarda el documento en borrador para definir la firma más adelante.',
    },
  ]

  // Si la acción seleccionada es cerrar_firmado pero el PDF no tiene firmas, cambiar default
  useEffect(() => {
    if (accion === 'cerrar_firmado' && !analisis?.has_signatures) {
      setAccion(analisis?.has_signatures ? 'cerrar_firmado' : 'firmar_propio')
    }
    if (activeStep === 2 && !analisis?.has_signatures && accion === 'cerrar_firmado') {
      setAccion('firmar_propio')
    }
    // Si tiene firmas, sugerir cerrar_firmado por default al entrar al paso 3
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, analisis?.has_signatures])

  const handleSubmit = async () => {
    if (!analisis) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await documentosAPI.subirDocumento({
        token: analisis.token,
        titulo: titulo.trim(),
        tipo_documental_id: Number(tipoDocumentalId),
        descripcion: descripcion.trim() || undefined,
        palabras_clave: palabrasClave.trim() || undefined,
        nivel_acceso: nivelAcceso,
        expediente_id: expedienteSel?.id,
        firmas_externas: analisis.has_signatures ? analisis.signatures : undefined,
        accion,
        firmantes_asignados: accion === 'enviar_firma' ? firmantesSel.map((f) => f.id) : undefined,
      })
      if (res.success && res.data) {
        // Redirigir según acción
        if (accion === 'firmar_propio') {
          navigate(`/documentos/${res.data.id}?firmar=1`)
        } else {
          navigate(`/documentos/${res.data.id}`)
        }
      } else {
        setError(res.message || 'Error al subir el documento')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setError(err.response?.data?.message || 'Error al subir el documento')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/documentos')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight="bold">
          Subir documento PDF
        </Typography>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* PASO 1: Subir PDF */}
      {activeStep === 0 && (
        <Card>
          <CardContent>
            {!archivo ? (
              <Paper
                variant="outlined"
                sx={{
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: dragOver ? 'primary.main' : 'divider',
                  bgcolor: dragOver ? 'action.hover' : 'background.paper',
                  p: 6,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Arrastra el PDF aquí o haz clic para seleccionar
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Formato PDF · Tamaño máximo 20 MB
                </Typography>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={handleFileChange}
                />
              </Paper>
            ) : (
              <Box>
                <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PdfIcon color="error" sx={{ fontSize: 40 }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" fontWeight="medium">
                      {archivo.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(archivo.size)}
                    </Typography>
                  </Box>
                  <IconButton onClick={handleQuitarArchivo} disabled={analizando}>
                    <DeleteIcon />
                  </IconButton>
                </Paper>

                {analizando ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress size={32} sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Analizando firmas electrónicas del PDF...
                    </Typography>
                  </Box>
                ) : analisis ? (
                  <Box>
                    {analisis.has_signatures ? (
                      <Alert severity="success" icon={<VerifiedIcon />}>
                        <AlertTitle>
                          {analisis.signatures.length === 1
                            ? '1 firma electrónica detectada'
                            : `${analisis.signatures.length} firmas electrónicas detectadas`}
                        </AlertTitle>
                        Este PDF contiene firmas digitales embebidas. Podrás registrarlo como ya firmado en el último paso.
                      </Alert>
                    ) : (
                      <Alert severity="info" icon={<UnsignedIcon />}>
                        <AlertTitle>El PDF no contiene firmas electrónicas</AlertTitle>
                        Podrás firmarlo tú mismo o derivarlo a otro funcionario para su firma.
                      </Alert>
                    )}

                    {analisis.has_signatures && (
                      <List dense sx={{ mt: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        {analisis.signatures.map((firma, idx) => (
                          <ListItem key={idx}>
                            <ListItemIcon>
                              {firma.valid ? (
                                <CheckIcon color="success" />
                              ) : (
                                <ErrorIcon color="warning" />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={firma.signer}
                              secondary={
                                <>
                                  {firma.date && <span>Firmado el {firma.date}</span>}
                                  {' · '}
                                  <span>{firma.valid ? 'Firma válida' : 'Firma no verificada'}</span>
                                </>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}

                    {analisis.detector_error && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        No se pudo verificar firmas: {analisis.detector_error}
                      </Alert>
                    )}
                  </Box>
                ) : null}
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                endIcon={<NextIcon />}
                disabled={!puedeAvanzarPaso1}
                onClick={() => setActiveStep(1)}
              >
                Continuar
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* PASO 2: Metadatos */}
      {activeStep === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Metadatos del documento
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Estos datos te permitirán encontrar y clasificar el documento.
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Título"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título descriptivo del documento"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Tipo documental</InputLabel>
                  <Select
                    value={tipoDocumentalId}
                    label="Tipo documental"
                    onChange={(e) => setTipoDocumentalId(e.target.value as number)}
                  >
                    {tiposDocumentales.map((tipo) => (
                      <MenuItem key={tipo.id} value={tipo.id}>
                        {tipo.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Nivel de acceso"
                  value={nivelAcceso}
                  onChange={(e) => setNivelAcceso(Number(e.target.value))}
                >
                  {NIVELES_ACCESO.map((n) => (
                    <MenuItem key={n.value} value={n.value}>
                      {n.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Descripción"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Resumen del contenido del documento"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Palabras clave"
                  value={palabrasClave}
                  onChange={(e) => setPalabrasClave(e.target.value)}
                  placeholder="Separadas por comas (ej: presupuesto, 2026, obras)"
                  helperText="Ayudan a encontrar el documento en búsquedas"
                />
              </Grid>

              <Grid item xs={12}>
                <Autocomplete
                  options={expedientes}
                  value={expedienteSel}
                  onChange={(_, val) => setExpedienteSel(val)}
                  getOptionLabel={(opt) => `${opt.numero_expediente || opt.identificador || ''} — ${opt.titulo}`}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Asociar a expediente (opcional)"
                      placeholder="Buscar expediente abierto..."
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={() => setActiveStep(0)}>Atrás</Button>
              <Button
                variant="contained"
                endIcon={<NextIcon />}
                disabled={!puedeAvanzarPaso2}
                onClick={() => setActiveStep(2)}
              >
                Continuar
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* PASO 3: Acción */}
      {activeStep === 2 && analisis && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              ¿Qué quieres hacer con el documento?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {analisis.has_signatures
                ? `Detectamos ${analisis.signatures.length} firma(s) en el PDF. Puedes registrarlo como firmado o agregar más firmas.`
                : 'El PDF no tiene firmas. Define cómo se firmará en la plataforma.'}
            </Typography>

            <FormControl component="fieldset" fullWidth>
              <RadioGroup value={accion} onChange={(e) => setAccion(e.target.value as AccionSubida)}>
                <Stack spacing={1.5}>
                  {opcionesAccion.map((op) => (
                    <Paper
                      key={op.value}
                      variant="outlined"
                      sx={{
                        p: 2,
                        cursor: op.disabled ? 'not-allowed' : 'pointer',
                        opacity: op.disabled ? 0.5 : 1,
                        borderColor: accion === op.value ? 'primary.main' : 'divider',
                        bgcolor: accion === op.value ? 'action.selected' : 'background.paper',
                      }}
                      onClick={() => !op.disabled && setAccion(op.value)}
                    >
                      <FormControlLabel
                        value={op.value}
                        disabled={op.disabled}
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {op.label}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {op.descripcion}
                            </Typography>
                          </Box>
                        }
                        sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
                      />
                    </Paper>
                  ))}
                </Stack>
              </RadioGroup>
            </FormControl>

            {accion === 'enviar_firma' && (
              <Box sx={{ mt: 3 }}>
                <FormLabel sx={{ mb: 1, display: 'block' }}>Firmantes asignados</FormLabel>
                <Autocomplete
                  multiple
                  options={funcionarios}
                  value={firmantesSel}
                  onChange={(_, val) => setFirmantesSel(val)}
                  getOptionLabel={(opt) => `${opt.nombre}${opt.cargo ? ` — ${opt.cargo}` : ''}`}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                  renderTags={(value, getTagProps) =>
                    value.map((opt, idx) => (
                      <Chip label={opt.nombre} {...getTagProps({ index: idx })} key={opt.id} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Selecciona uno o más funcionarios..." />
                  )}
                />
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={() => setActiveStep(1)} disabled={submitting}>
                Atrás
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={submitting || (accion === 'enviar_firma' && firmantesSel.length === 0)}
                startIcon={submitting ? <CircularProgress size={16} /> : null}
              >
                {submitting ? 'Subiendo...' : 'Subir documento'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}

export default DocumentoUpload
