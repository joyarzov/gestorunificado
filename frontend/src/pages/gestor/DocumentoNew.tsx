import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  FormatAlignLeft as AlignLeftIcon,
  FormatAlignCenter as AlignCenterIcon,
  FormatAlignJustify as AlignJustifyIcon,
  FormatBold as BoldIcon,
  TableChart as TableIcon,
} from '@mui/icons-material'
import { documentosAPI, expedientesAPI } from '../../api/gestor'
import { usersAPI, departamentosAPI } from '../../api/common'
import { DocumentoPlantilla, Expediente, User, Departamento } from '../../types'
import { useAuth } from '../../contexts/AuthContext'

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
  const { user } = useAuth()
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

  // Responsive document preview scaling
  const [docScale, setDocScale] = useState(1)
  const observerRef = useRef<ResizeObserver | null>(null)

  const previewContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }
    if (node) {
      const update = () => {
        const containerWidth = node.clientWidth - 32
        setDocScale(Math.min(1, containerWidth / 794))
      }
      update()
      observerRef.current = new ResizeObserver(update)
      observerRef.current.observe(node)
    }
  }, [])

  useEffect(() => {
    return () => { observerRef.current?.disconnect() }
  }, [])

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
  const [fieldAlignments, setFieldAlignments] = useState<Record<string, string>>({})

  // Ref para el editor de contenido del memo
  const contenidoEditorRef = useRef<HTMLDivElement>(null)

  // Determinar si es decreto (tiene artículos)
  const esDecreto = useMemo(() => {
    if (!selectedPlantilla) return false
    return selectedPlantilla.codigo === 'PLT_DECRETO_001' ||
           selectedPlantilla.codigo.toLowerCase().includes('decreto')
  }, [selectedPlantilla])

  // Determinar si es memorándum
  const esMemo = useMemo(() => {
    if (!selectedPlantilla) return false
    return selectedPlantilla.codigo === 'PLT_MEMO_001' ||
           selectedPlantilla.codigo.toLowerCase().includes('memo')
  }, [selectedPlantilla])

  // Determinar si la plantilla usa firmas y distribución dinámicas
  const usaFirmasDinamicas = useMemo(() => {
    if (!selectedPlantilla?.variables_json) return false
    return 'firmas_html' in selectedPlantilla.variables_json
  }, [selectedPlantilla])

  const usaDistribucion = useMemo(() => {
    if (!selectedPlantilla?.variables_json) return false
    return 'distribucion_html' in selectedPlantilla.variables_json
  }, [selectedPlantilla])

  // Proteger contra pérdida de datos no guardados
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (selectedPlantilla !== null) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [selectedPlantilla])

  // Inicializar contenido del editor rich text al volver al paso 2
  useEffect(() => {
    if (activeStep === 1 && esMemo && contenidoEditorRef.current) {
      const val = variables.contenido || ''
      if (contenidoEditorRef.current.innerHTML !== val) {
        contenidoEditorRef.current.innerHTML = val
      }
    }
  }, [activeStep, esMemo])

  // Helpers para el editor de contenido rich text
  const execFormatCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    if (contenidoEditorRef.current) {
      handleVariableChange('contenido', contenidoEditorRef.current.innerHTML)
    }
  }

  const insertTable = () => {
    const tableHtml = '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;"><tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p>&nbsp;</p>'
    document.execCommand('insertHTML', false, tableHtml)
    if (contenidoEditorRef.current) {
      handleVariableChange('contenido', contenidoEditorRef.current.innerHTML)
    }
  }

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

    // Auto-llenar remitente en memorándum con el usuario logueado
    const esMemoPlantilla = plantilla.codigo === 'PLT_MEMO_001' || plantilla.codigo.toLowerCase().includes('memo')
    if (esMemoPlantilla && user) {
      varsIniciales['de'] = user.nombre + (user.cargo ? `\n${user.cargo}` : '')
    }

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

    return articulosValidos.map((art, index) => {
      const align = fieldAlignments[`articulo_${art.id}`] || 'left'
      return `
      <div style="margin: 20px 0;">
        <p><strong>ARTÍCULO ${ORDINAL_NAMES[index] || (index + 1)}°:</strong></p>
        <p style="margin-left: 20px; text-align: ${align};">${art.contenido}</p>
      </div>
    `
    }).join('')
  }, [articulos, fieldAlignments])

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

        // Aplicar alineación a campos de texto
        for (const campo of ['vistos', 'texto_decreto'] as const) {
          const align = fieldAlignments[campo]
          if (align && align !== 'left' && variablesCompletas[campo]) {
            variablesCompletas[campo] = `<div style="text-align: ${align};">${variablesCompletas[campo]}</div>`
          }
        }
      }

      if (usaFirmasDinamicas) {
        variablesCompletas['firmas_html'] = generarFirmasHtml()
      }
      if (usaDistribucion) {
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
  }, [selectedPlantilla, variables, esDecreto, usaFirmasDinamicas, usaDistribucion, fieldAlignments, generarArticulosHtml, generarFirmasHtml, generarDistribucionHtml])

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

        // Aplicar alineación a campos de texto
        for (const campo of ['vistos', 'texto_decreto'] as const) {
          const align = fieldAlignments[campo]
          if (align && align !== 'left' && variablesFinales[campo]) {
            variablesFinales[campo] = `<div style="text-align: ${align};">${variablesFinales[campo]}</div>`
          }
        }
      }
      if (usaFirmasDinamicas) {
        variablesFinales['firmas_html'] = generarFirmasHtml()
      }
      if (usaDistribucion) {
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

  // Alineación de campos de texto
  const getAlignment = (key: string) => fieldAlignments[key] || 'left'
  const setAlignment = (key: string, value: string) => {
    setFieldAlignments(prev => ({ ...prev, [key]: value }))
  }

  const renderAlignmentToolbar = (key: string) => (
    <ToggleButtonGroup
      value={getAlignment(key)}
      exclusive
      onChange={(_, v) => { if (v) setAlignment(key, v) }}
      size="small"
    >
      <ToggleButton value="left" aria-label="Alinear izquierda">
        <AlignLeftIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="center" aria-label="Centrar">
        <AlignCenterIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="justify" aria-label="Justificar">
        <AlignJustifyIcon fontSize="small" />
      </ToggleButton>
    </ToggleButtonGroup>
  )

  // Renderizar campos de variable
  const renderVariableField = (key: string, descripcion: string) => {
    // Omitir campos que se generan automáticamente
    if (['articulos_html', 'firmas_html', 'distribucion_html'].includes(key)) {
      return null
    }

    // Memo: "de" es read-only (usuario logueado)
    if (esMemo && key === 'de') {
      return (
        <Grid item xs={12} md={6} key={key}>
          <TextField
            fullWidth
            label="Remitente (De)"
            value={variables[key] || ''}
            disabled
            multiline
            rows={2}
          />
        </Grid>
      )
    }

    // Memo: "para" es selector de funcionarios con cargo
    if (esMemo && key === 'para') {
      return (
        <Grid item xs={12} md={6} key={key}>
          <Autocomplete
            options={funcionarios}
            getOptionLabel={(option) => `${option.nombre}${option.cargo ? ` - ${option.cargo}` : option.departamento ? ` - ${option.departamento.nombre}` : ''}`}
            value={funcionarios.find(f => variables[key]?.startsWith(f.nombre)) || null}
            onChange={(_, newValue) => {
              if (newValue) {
                handleVariableChange(key, newValue.nombre + (newValue.cargo ? `\n${newValue.cargo}` : ''))
                handleVariableChange('_destinatario_id', String(newValue.id))
              } else {
                handleVariableChange(key, '')
                handleVariableChange('_destinatario_id', '')
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Destinatario (Para)"
                placeholder="Seleccionar funcionario..."
              />
            )}
          />
          {variables[key] && (
            <TextField
              fullWidth
              value={variables[key]}
              disabled
              multiline
              rows={2}
              sx={{ mt: 1 }}
            />
          )}
        </Grid>
      )
    }

    // Memo: contenido con editor rich text
    if (esMemo && key === 'contenido') {
      return (
        <Grid item xs={12} key={key}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Contenido del memorándum
          </Typography>
          <Box
            sx={{
              border: '1px solid rgba(0,0,0,0.23)',
              borderRadius: 1,
              '&:focus-within': { borderColor: 'primary.main', borderWidth: 2 },
            }}
          >
            {/* Toolbar */}
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                p: 1,
                borderBottom: '1px solid rgba(0,0,0,0.12)',
                bgcolor: '#f5f5f5',
                borderRadius: '4px 4px 0 0',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <ToggleButtonGroup
                exclusive
                size="small"
                onChange={(_, v) => {
                  if (v) execFormatCommand(v === 'left' ? 'justifyLeft' : v === 'center' ? 'justifyCenter' : 'justifyFull')
                }}
              >
                <ToggleButton value="left" aria-label="Alinear izquierda" onMouseDown={(e) => e.preventDefault()}>
                  <AlignLeftIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="center" aria-label="Centrar" onMouseDown={(e) => e.preventDefault()}>
                  <AlignCenterIcon fontSize="small" />
                </ToggleButton>
                <ToggleButton value="justify" aria-label="Justificar" onMouseDown={(e) => e.preventDefault()}>
                  <AlignJustifyIcon fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <IconButton
                size="small"
                onClick={() => execFormatCommand('bold')}
                onMouseDown={(e) => e.preventDefault()}
                title="Negrita"
              >
                <BoldIcon fontSize="small" />
              </IconButton>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <IconButton
                size="small"
                onClick={insertTable}
                onMouseDown={(e) => e.preventDefault()}
                title="Insertar tabla"
              >
                <TableIcon fontSize="small" />
              </IconButton>
            </Box>
            {/* Editor */}
            <Box
              ref={contenidoEditorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                if (contenidoEditorRef.current) {
                  handleVariableChange('contenido', contenidoEditorRef.current.innerHTML)
                }
              }}
              sx={{
                p: 2,
                minHeight: 200,
                maxHeight: 600,
                resize: 'vertical',
                overflow: 'auto',
                outline: 'none',
                fontFamily: '"Times New Roman", serif',
                fontSize: '14px',
                lineHeight: 1.6,
                '& table': { borderCollapse: 'collapse', width: '100%', my: 1 },
                '& td, & th': { border: '1px solid #999', p: 1, minWidth: 40 },
              }}
            />
          </Box>
        </Grid>
      )
    }

    const esMultilinea = ['vistos', 'contenido', 'objeto', 'obligaciones', 'vigencia', 'considerando', 'resuelvo', 'texto_decreto'].includes(key)

    // Overrides para decreto y memo
    const esNumeroEspecial = (esDecreto || esMemo) && key === 'numero'
    const esTextoDecreto = esDecreto && key === 'texto_decreto'
    const tieneAlineacion = esDecreto && ['vistos', 'texto_decreto'].includes(key)

    let label = descripcion || key
    if (esDecreto && key === 'numero') label = 'Número de decreto'
    if (esMemo && key === 'numero') label = 'Número de memorándum'
    if (esTextoDecreto) label = 'DECRETO'

    return (
      <Grid item xs={12} md={esMultilinea ? 12 : 6} key={key}>
        {tieneAlineacion && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
            {renderAlignmentToolbar(key)}
          </Box>
        )}
        <TextField
          fullWidth
          label={label}
          value={variables[key] || ''}
          onChange={(e) => {
            if (esNumeroEspecial) {
              handleVariableChange(key, e.target.value.replace(/[^0-9]/g, ''))
            } else {
              handleVariableChange(key, e.target.value)
            }
          }}
          multiline={esMultilinea}
          rows={esMultilinea ? 4 : 1}
          placeholder={esNumeroEspecial ? 'Ingrese número' : descripcion}
          inputProps={esNumeroEspecial ? { inputMode: 'numeric' as const, pattern: '[0-9]*' } : undefined}
          sx={tieneAlineacion ? { '& textarea': { textAlign: getAlignment(key) } } : undefined}
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
        {esDecreto && selectedPlantilla?.variables_json ? (
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">
                      {ORDINAL_NAMES[index] || `${index + 1}°`}:
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {renderAlignmentToolbar(`articulo_${articulo.id}`)}
                      <IconButton
                        onClick={() => eliminarArticulo(articulo.id)}
                        disabled={articulos.length <= 1}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    value={articulo.contenido}
                    onChange={(e) => actualizarArticulo(articulo.id, e.target.value)}
                    placeholder="Contenido del artículo..."
                    sx={{ '& textarea': { textAlign: getAlignment(`articulo_${articulo.id}`) } }}
                  />
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

        {/* Distribución */}
        {usaDistribucion && (
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
          <Box
            ref={previewContainerRef}
            sx={{
              bgcolor: '#e0e0e0',
              borderRadius: 1,
              p: 2,
              maxHeight: '75vh',
              overflow: 'auto',
              pb: 2,
            }}
          >
            {previewHtml ? (
              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <Box
                  sx={{
                    width: 794,
                    minHeight: 1056 * docScale,
                    bgcolor: 'white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                    p: '60px 94px 76px 113px',
                    fontFamily: 'serif',
                    fontSize: '12pt',
                    lineHeight: 1.6,
                    transform: `scale(${docScale})`,
                    transformOrigin: 'top center',
                    mb: docScale < 1 ? `${-(1 - docScale) * 1056}px` : 0,
                    '& > div': {
                      maxWidth: '100% !important',
                      padding: '0 !important',
                      margin: '0 !important',
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </Box>
            ) : (
              <Typography color="text.secondary" sx={{ textAlign: 'center', pt: 10 }}>
                Complete los campos para ver la previsualización
              </Typography>
            )}
          </Box>
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
        <Box
          ref={previewContainerRef}
          sx={{
            bgcolor: '#e0e0e0',
            borderRadius: 1,
            p: 2,
            maxHeight: '75vh',
            overflow: 'auto',
            pb: 2,
          }}
        >
          {previewHtml ? (
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <Box
                sx={{
                  width: 794,
                  minHeight: 1056 * docScale,
                  bgcolor: 'white',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                  p: '60px 94px 76px 113px',
                  transform: `scale(${docScale})`,
                  transformOrigin: 'top center',
                  mb: docScale < 1 ? `${-(1 - docScale) * 1056}px` : 0,
                  '& > div': {
                    maxWidth: '100% !important',
                    padding: '0 !important',
                    margin: '0 !important',
                    lineHeight: '1.6 !important',
                  },
                }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ textAlign: 'center', pt: 10 }}>
              Sin previsualización
            </Typography>
          )}
        </Box>
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
