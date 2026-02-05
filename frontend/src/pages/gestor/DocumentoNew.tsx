import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Divider,
  IconButton,
  Paper,
  Autocomplete,
} from '@mui/material'
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material'
import { documentosAPI, expedientesAPI } from '../../api/gestor'
import { usersAPI, departamentosAPI } from '../../api/common'
import { DocumentoPlantilla, Expediente, User, Departamento } from '../../types'

// Nombres de artículos en español
const ORDINAL_NAMES = [
  'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO',
  'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO',
  'UNDÉCIMO', 'DUODÉCIMO', 'DECIMOTERCERO', 'DECIMOCUARTO', 'DECIMOQUINTO'
]

const NIVELES_ACCESO = [
  { value: 1, label: 'Público' },
  { value: 2, label: 'Restringido' },
  { value: 3, label: 'Reservado' },
  { value: 4, label: 'Secreto' },
]

const steps = ['Seleccionar Plantilla', 'Completar Datos', 'Revisar y Guardar']

interface ArticuloDecreto {
  id: string
  contenido: string
}

interface DistribucionItem {
  id: number
  nombre: string
}

const DocumentoNew = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const expedienteIdParam = searchParams.get('expediente_id')

  // Estados principales
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Datos
  const [plantillas, setPlantillas] = useState<DocumentoPlantilla[]>([])
  const [expedientes, setExpedientes] = useState<Expediente[]>([])
  const [funcionarios, setFuncionarios] = useState<User[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Formulario
  const [selectedPlantilla, setSelectedPlantilla] = useState<DocumentoPlantilla | null>(null)
  const [titulo, setTitulo] = useState('')
  const [expedientesSeleccionados, setExpedientesSeleccionados] = useState<Expediente[]>([])
  const expedienteDesdeParam = !!expedienteIdParam
  const [nivelAcceso, setNivelAcceso] = useState(1)
  const [palabrasClave, setPalabrasClave] = useState('')
  const [firmantesSeleccionados, setFirmantesSeleccionados] = useState<User[]>([])
  const [variables, setVariables] = useState<Record<string, string>>({})

  // Campos especiales para decretos
  const [articulos, setArticulos] = useState<ArticuloDecreto[]>([
    { id: '1', contenido: '' }
  ])
  const [distribucion, setDistribucion] = useState<DistribucionItem[]>([])

  // Determinar si es decreto
  const esDecreto = useMemo(() => {
    if (!selectedPlantilla) return false
    return selectedPlantilla.codigo === 'PLT_DECRETO_001' ||
           selectedPlantilla.codigo.toLowerCase().includes('decreto')
  }, [selectedPlantilla])

  // Cargar datos iniciales
  useEffect(() => {
    loadDatos()
  }, [])

  // Auto-asociar expediente cuando viene desde la URL
  useEffect(() => {
    if (expedienteIdParam && expedientes.length > 0 && expedientesSeleccionados.length === 0) {
      const exp = expedientes.find(e => e.id === Number(expedienteIdParam))
      if (exp) {
        setExpedientesSeleccionados([exp])
      }
    }
  }, [expedientes, expedienteIdParam])

  const loadDatos = async () => {
    try {
      const [plantillasRes, expsRes, funcsRes, deptosRes] = await Promise.all([
        documentosAPI.getPlantillas(),
        expedientesAPI.listar({ estado: 'abierto', per_page: 100 }),
        usersAPI.funcionarios(),
        departamentosAPI.listar(),
      ])
      setPlantillas(plantillasRes)
      setExpedientes(expsRes.data.data)
      setFuncionarios(funcsRes.data)
      setDepartamentos(deptosRes.data.filter((d: Departamento) => d.activo))
    } catch (error) {
      console.error('Error cargando datos:', error)
      setError('Error al cargar los datos necesarios')
    }
  }

  // Manejar selección de plantilla
  const handleSelectPlantilla = (plantilla: DocumentoPlantilla) => {
    setSelectedPlantilla(plantilla)
    // Inicializar variables vacías según la plantilla
    const varsIniciales: Record<string, string> = {}
    if (plantilla.variables_json) {
      Object.keys(plantilla.variables_json).forEach(key => {
        // No inicializar campos especiales que se generan automáticamente
        if (!['articulos_html', 'firmas_html', 'distribucion_html'].includes(key)) {
          varsIniciales[key] = ''
        }
      })
    }
    // Agregar fecha actual
    const hoy = new Date()
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    varsIniciales['fecha'] = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`
    varsIniciales['anio'] = String(hoy.getFullYear())

    setVariables(varsIniciales)
    setActiveStep(1)
  }

  // Actualizar variable
  const handleVariableChange = (key: string, value: string) => {
    setVariables(prev => ({ ...prev, [key]: value }))
  }

  // Generar HTML de artículos
  const generarArticulosHtml = useCallback(() => {
    const articulosValidos = articulos.filter(a => a.contenido.trim())
    if (articulosValidos.length === 0) return ''

    return articulosValidos.map((art, index) => `
      <div style="margin: 20px 0;">
        <p><strong>ARTÍCULO ${ORDINAL_NAMES[index] || (index + 1)}°:</strong></p>
        <p style="margin-left: 20px;">${art.contenido}</p>
      </div>
    `).join('')
  }, [articulos])

  // Generar HTML de firmas (3 por fila)
  const generarFirmasHtml = useCallback(() => {
    if (firmantesSeleccionados.length === 0) return ''

    const filas: User[][] = []
    for (let i = 0; i < firmantesSeleccionados.length; i += 3) {
      filas.push(firmantesSeleccionados.slice(i, i + 3))
    }

    return filas.map(fila => `
      <div style="display: flex; justify-content: space-around; margin: 40px 0;">
        ${fila.map(user => `
          <div style="text-align: center; min-width: 200px;">
            <p>___________________________</p>
            <p><strong>${user.nombre}</strong></p>
            <p style="font-size: 10pt; color: #666;">${user.rut}</p>
          </div>
        `).join('')}
      </div>
    `).join('')
  }, [firmantesSeleccionados])

  // Generar HTML de distribución
  const generarDistribucionHtml = useCallback(() => {
    if (distribucion.length === 0) return ''

    return `<ul style="list-style-type: disc; margin-left: 20px;">
      ${distribucion.map(d => `<li>${d.nombre}</li>`).join('')}
    </ul>`
  }, [distribucion])

  // Previsualizar documento (con debounce)
  const handlePreview = useCallback(async () => {
    if (!selectedPlantilla) return

    setPreviewLoading(true)
    try {
      // Preparar variables con campos especiales
      const variablesCompletas = { ...variables }

      if (esDecreto) {
        variablesCompletas['articulos_html'] = generarArticulosHtml()
        variablesCompletas['firmas_html'] = generarFirmasHtml()
        variablesCompletas['distribucion_html'] = generarDistribucionHtml()
      }

      const response = await documentosAPI.previsualizar({
        plantilla_id: selectedPlantilla.id,
        contenido_json: variablesCompletas
      })
      setPreviewHtml(response.html)
    } catch (error) {
      console.error('Error generando preview:', error)
    } finally {
      setPreviewLoading(false)
    }
  }, [selectedPlantilla, variables, esDecreto, generarArticulosHtml, generarFirmasHtml, generarDistribucionHtml])

  // Debounce para preview automático
  useEffect(() => {
    if (activeStep !== 1 || !selectedPlantilla) return

    const timer = setTimeout(() => {
      handlePreview()
    }, 500)

    return () => clearTimeout(timer)
  }, [variables, articulos, distribucion, firmantesSeleccionados, activeStep, selectedPlantilla, handlePreview])

  // Agregar artículo
  const agregarArticulo = () => {
    setArticulos(prev => [...prev, { id: String(Date.now()), contenido: '' }])
  }

  // Eliminar artículo
  const eliminarArticulo = (id: string) => {
    if (articulos.length > 1) {
      setArticulos(prev => prev.filter(a => a.id !== id))
    }
  }

  // Actualizar artículo
  const actualizarArticulo = (id: string, contenido: string) => {
    setArticulos(prev => prev.map(a => a.id === id ? { ...a, contenido } : a))
  }

  // Actualizar distribución (selección de departamentos)
  const handleDistribucionChange = (selectedDepts: Departamento[]) => {
    setDistribucion(selectedDepts.map(d => ({ id: d.id, nombre: d.nombre })))
  }

  // Guardar documento como borrador
  const handleSubmit = async () => {
    if (!selectedPlantilla || !titulo.trim()) {
      setError('Complete todos los campos requeridos')
      return
    }

    setError('')
    setLoading(true)

    try {
      // Preparar variables finales
      const variablesFinales = { ...variables }
      if (esDecreto) {
        variablesFinales['articulos_html'] = generarArticulosHtml()
        variablesFinales['firmas_html'] = generarFirmasHtml()
        variablesFinales['distribucion_html'] = generarDistribucionHtml()
      }

      const data = {
        titulo,
        plantilla_id: selectedPlantilla.id,
        expedientes_ids: expedientesSeleccionados.length > 0
          ? expedientesSeleccionados.map(e => e.id)
          : undefined,
        tipo_documental_id: selectedPlantilla.tipo_documental_id,
        nivel_acceso: nivelAcceso,
        contenido_json: variablesFinales,
        palabras_clave: palabrasClave || undefined,
        firmantes_asignados: firmantesSeleccionados.map(f => f.id),
        firmas_requeridas: firmantesSeleccionados.length || undefined,
      }

      const response = await documentosAPI.crear(data)
      setSuccess('Documento guardado como borrador exitosamente')

      setTimeout(() => {
        navigate(`/documentos/${response.data.id}`)
      }, 1500)

    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'Error al crear documento')
    } finally {
      setLoading(false)
    }
  }

  // Renderizar paso 1: Selección de plantilla
  const renderStep1 = () => (
    <Grid container spacing={3}>
      {plantillas.map(plantilla => (
        <Grid item xs={12} sm={6} md={4} key={plantilla.id}>
          <Card
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: selectedPlantilla?.id === plantilla.id ? '2px solid primary.main' : '1px solid #e0e0e0',
              '&:hover': {
                boxShadow: 4,
                transform: 'translateY(-2px)'
              }
            }}
            onClick={() => handleSelectPlantilla(plantilla)}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {plantilla.nombre}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {plantilla.descripcion || 'Sin descripción'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {plantilla.tipo_documental && (
                  <Chip label={plantilla.tipo_documental.nombre} size="small" color="primary" variant="outlined" />
                )}
                {plantilla.requiere_firma && (
                  <Chip label="Requiere firma" size="small" color="warning" variant="outlined" />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )

  // Renderizar campos de variable
  const renderVariableField = (key: string, descripcion: string) => {
    // Omitir campos que se generan automáticamente
    if (['articulos_html', 'firmas_html', 'distribucion_html'].includes(key)) {
      return null
    }

    const esMultilinea = ['vistos', 'contenido', 'objeto', 'obligaciones', 'vigencia', 'considerando', 'resuelvo', 'texto_decreto'].includes(key)

    return (
      <Grid item xs={12} md={esMultilinea ? 12 : 6} key={key}>
        <TextField
          fullWidth
          label={descripcion || key}
          value={variables[key] || ''}
          onChange={(e) => handleVariableChange(key, e.target.value)}
          multiline={esMultilinea}
          rows={esMultilinea ? 4 : 1}
          placeholder={descripcion}
        />
      </Grid>
    )
  }

  // Renderizar paso 2: Completar datos
  const renderStep2 = () => {
    if (!selectedPlantilla) return null

    return (
      <Grid container spacing={3}>
        {/* Datos generales */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Datos Generales
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            required
            label="Título del documento"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Decreto sobre modificación presupuestaria"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          {expedienteDesdeParam ? (
            <TextField
              fullWidth
              label="Expediente"
              value={expedientesSeleccionados.length > 0
                ? `${expedientesSeleccionados[0].numero_expediente} - ${expedientesSeleccionados[0].titulo}`
                : 'Cargando...'}
              disabled
            />
          ) : (
            <Autocomplete
              multiple
              options={expedientes}
              getOptionLabel={(option) => `${option.numero_expediente} - ${option.titulo.substring(0, 40)}`}
              value={expedientesSeleccionados}
              onChange={(_, newValue) => setExpedientesSeleccionados(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Expedientes (opcional)"
                  placeholder="Buscar expediente..."
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.numero_expediente}
                    {...getTagProps({ index })}
                    key={option.id}
                  />
                ))
              }
            />
          )}
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Nivel de Acceso</InputLabel>
            <Select
              value={nivelAcceso}
              onChange={(e) => setNivelAcceso(Number(e.target.value))}
              label="Nivel de Acceso"
            >
              {NIVELES_ACCESO.map(nivel => (
                <MenuItem key={nivel.value} value={nivel.value}>
                  {nivel.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Palabras clave"
            value={palabrasClave}
            onChange={(e) => setPalabrasClave(e.target.value)}
            placeholder="Separadas por comas"
          />
        </Grid>

        {/* Firmantes */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Firmantes Asignados
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={funcionarios}
            getOptionLabel={(option) => `${option.nombre} (${option.rut})`}
            value={firmantesSeleccionados}
            onChange={(_, newValue) => setFirmantesSeleccionados(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Seleccionar firmantes"
                placeholder="Buscar funcionario..."
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={option.nombre}
                  {...getTagProps({ index })}
                  key={option.id}
                />
              ))
            }
          />
        </Grid>

        {/* Variables de la plantilla */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Campos de la Plantilla
          </Typography>
        </Grid>

        {/* Para decretos: mostrar variables antes de texto_decreto, luego artículos, luego texto_decreto */}
        {esDecreto && selectedPlantilla.variables_json ? (
          <>
            {/* Variables excepto texto_decreto */}
            {Object.entries(selectedPlantilla.variables_json)
              .filter(([key]) => key !== 'texto_decreto')
              .map(([key, descripcion]) => renderVariableField(key, descripcion))}

            {/* Artículos del Decreto */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">
                  Artículos del Decreto
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={agregarArticulo}
                  variant="outlined"
                  size="small"
                >
                  Agregar Artículo
                </Button>
              </Box>
            </Grid>

            {articulos.map((articulo, index) => (
              <Grid item xs={12} key={articulo.id}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Typography variant="subtitle2" sx={{ minWidth: 100, pt: 1 }}>
                      {ORDINAL_NAMES[index] || `${index + 1}°`}:
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      value={articulo.contenido}
                      onChange={(e) => actualizarArticulo(articulo.id, e.target.value)}
                      placeholder="Contenido del artículo..."
                    />
                    <IconButton
                      onClick={() => eliminarArticulo(articulo.id)}
                      disabled={articulos.length <= 1}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Paper>
              </Grid>
            ))}

            {/* Texto del decreto (después de artículos) */}
            {selectedPlantilla.variables_json['texto_decreto'] &&
              renderVariableField('texto_decreto', selectedPlantilla.variables_json['texto_decreto'])}
          </>
        ) : (
          /* Para otros tipos de documento: mostrar todas las variables normalmente */
          selectedPlantilla.variables_json && Object.entries(selectedPlantilla.variables_json).map(
            ([key, descripcion]) => renderVariableField(key, descripcion)
          )
        )}

        {/* Distribución para decretos */}
        {esDecreto && (
          <>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Distribución
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={departamentos}
                getOptionLabel={(option) => option.nombre}
                value={departamentos.filter(d => distribucion.some(dist => dist.id === d.id))}
                onChange={(_, newValue) => handleDistribucionChange(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Departamentos para distribución"
                    placeholder="Seleccionar departamento..."
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.nombre}
                      {...getTagProps({ index })}
                      key={option.id}
                    />
                  ))
                }
              />
            </Grid>
          </>
        )}

        {/* Preview */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">
              Previsualización
            </Typography>
            <Button
              startIcon={previewLoading ? <CircularProgress size={16} /> : <PreviewIcon />}
              onClick={handlePreview}
              variant="outlined"
              disabled={previewLoading}
            >
              Actualizar Preview
            </Button>
          </Box>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              minHeight: 400,
              maxHeight: 600,
              overflow: 'auto',
              bgcolor: '#fafafa'
            }}
          >
            {previewHtml ? (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <Typography color="text.secondary" sx={{ textAlign: 'center', pt: 10 }}>
                Complete los campos para ver la previsualización
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    )
  }

  // Renderizar paso 3: Revisar y guardar
  const renderStep3 = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Resumen del Documento
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Typography><strong>Plantilla:</strong> {selectedPlantilla?.nombre}</Typography>
              <Typography><strong>Título:</strong> {titulo}</Typography>
              <Typography><strong>Nivel de Acceso:</strong> {NIVELES_ACCESO.find(n => n.value === nivelAcceso)?.label}</Typography>
              {expedientesSeleccionados.length > 0 && (
                <Typography>
                  <strong>Expedientes:</strong> {expedientesSeleccionados.map(e => e.numero_expediente).join(', ')}
                </Typography>
              )}
              <Typography>
                <strong>Firmantes:</strong> {firmantesSeleccionados.length > 0
                  ? firmantesSeleccionados.map(f => f.nombre).join(', ')
                  : 'Sin firmantes asignados'}
              </Typography>
              {esDecreto && (
                <Typography><strong>Artículos:</strong> {articulos.filter(a => a.contenido.trim()).length}</Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          Previsualización del Documento
        </Typography>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            minHeight: 400,
            maxHeight: 600,
            overflow: 'auto',
            bgcolor: '#fafafa'
          }}
        >
          {previewHtml ? (
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          ) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', pt: 10 }}>
              Sin previsualización
            </Typography>
          )}
        </Paper>
      </Grid>
    </Grid>
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
          Volver
        </Button>
        <Typography variant="h4" fontWeight="bold">
          Nuevo Documento
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label, index) => (
          <Step key={label}>
            <StepLabel
              onClick={() => {
                if (index < activeStep || (index === 1 && selectedPlantilla)) {
                  setActiveStep(index)
                }
              }}
              sx={{ cursor: index <= activeStep ? 'pointer' : 'default' }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Contenido del paso */}
      <Card>
        <CardContent>
          {activeStep === 0 && renderStep1()}
          {activeStep === 1 && renderStep2()}
          {activeStep === 2 && renderStep3()}

          {/* Navegación */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Button
              disabled={activeStep === 0}
              onClick={() => setActiveStep(prev => prev - 1)}
            >
              Anterior
            </Button>

            <Box sx={{ display: 'flex', gap: 2 }}>
              {activeStep === 1 && (
                <Button
                  variant="contained"
                  onClick={() => {
                    handlePreview()
                    setActiveStep(2)
                  }}
                  disabled={!titulo.trim()}
                >
                  Siguiente
                </Button>
              )}

              {activeStep === 2 && (
                <Button
                  variant="contained"
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
                >
                  Guardar como Borrador
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default DocumentoNew
