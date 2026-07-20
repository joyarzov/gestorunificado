import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
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
  AttachFile as AttachFileIcon,
  PictureAsPdf as PdfIcon,
  BookmarkAdd as BookmarkAddIcon,
  Bookmark as BookmarkIcon,
} from '@mui/icons-material'
import { documentosAPI, expedientesAPI } from '../../api/gestor'
import { usersAPI, departamentosAPI } from '../../api/common'
import { DocumentoPlantilla, PlantillaPersonal, PlantillaPersonalContenido, Expediente, User, Departamento } from '../../types'
import { buildPreviewDoc } from '../../utils/previewDoc'
import SelectorFirmantes from '../../components/gestor/SelectorFirmantes'
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

// Campos que reciben mucho texto y se renderizan en una sección full-width debajo del split layout.
const LONG_TEXT_FIELDS = new Set([
  'vistos', 'considerando', 'resuelvo', 'texto_decreto',
  'contenido', 'objeto', 'obligaciones', 'vigencia',
  'antecedentes', 'desarrollo', 'conclusiones', 'recomendaciones',
  'asistentes', 'temas_tratados', 'acuerdos',
])

// Orden lógico de los campos por plantilla. Necesario porque MySQL JSON no preserva el orden de las claves.
// Las claves no listadas (firmas_html, distribucion_html, articulos_html) son auto-generadas y no se renderizan como campos.
const FIELD_ORDER: Record<string, string[]> = {
  PLT_DECRETO_001:    ['numero', 'fecha', 'referencia', 'vistos', 'texto_decreto'],
  PLT_MEMO_001:       ['numero', 'anio', 'fecha', 'referencia', 'de', 'para', 'contenido'],
  PLT_OFICIO_001:     ['numero', 'anio', 'fecha', 'antecedentes', 'materia', 'destinatario', 'cargo_destinatario', 'institucion', 'contenido'],
  PLT_ORDINARIO_001:  ['numero', 'anio', 'fecha', 'antecedentes', 'materia', 'de', 'para', 'contenido'],
  PLT_CIRCULAR_001:   ['numero', 'anio', 'fecha', 'materia', 'dirigida_a', 'contenido'],
  PLT_CARTA_001:      ['numero', 'anio', 'fecha', 'destinatario', 'cargo_destinatario', 'institucion', 'saludo', 'contenido', 'despedida'],
  PLT_ACTA_001:       ['numero', 'anio', 'tipo_reunion', 'fecha', 'hora', 'lugar', 'asistentes', 'temas_tratados', 'acuerdos'],
  PLT_INFORME_001:    ['numero', 'anio', 'fecha', 'asunto', 'antecedentes', 'desarrollo', 'conclusiones', 'recomendaciones'],
}

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
  const { id: editId } = useParams<{ id: string }>()
  const isEditMode = !!editId
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
  const [previewFull, setPreviewFull] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Responsive document preview scaling
  const [docScale, setDocScale] = useState(1)
  const observerRef = useRef<ResizeObserver | null>(null)

  // Carta (Letter): 8.5" × 11" → 794 × 1056 px @ 96dpi
  const PAGE_W = 794
  const PAGE_H = 1056
  const PAGE_ASPECT = PAGE_W / PAGE_H
  // Márgenes interiores tipo carta (procurador top, márgenes laterales y bottom)
  const PAD_T = 45
  const PAD_R = 76
  const PAD_B = 57
  const PAD_L = 94
  const USABLE_W = PAGE_W - PAD_L - PAD_R // 624
  const USABLE_H = PAGE_H - PAD_T - PAD_B // 954

  // Paginación del preview: medir alto del contenido para calcular cuántas páginas caben
  const [contentHeight, setContentHeight] = useState(USABLE_H)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const measureObserverRef = useRef<ResizeObserver | null>(null)

  const pageCount = Math.max(1, Math.ceil(contentHeight / USABLE_H))

  useEffect(() => {
    const node = measureRef.current
    if (measureObserverRef.current) {
      measureObserverRef.current.disconnect()
      measureObserverRef.current = null
    }
    if (!node) return
    const update = () => setContentHeight(Math.max(USABLE_H, node.scrollHeight))
    update()
    measureObserverRef.current = new ResizeObserver(update)
    measureObserverRef.current.observe(node)
    return () => {
      measureObserverRef.current?.disconnect()
    }
  }, [previewHtml])

  // Mide el ANCHO de la columna del preview (el contenedor gris se ajusta a la hoja)
  const previewContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }
    if (node) {
      const update = () => {
        const colWidth = node.clientWidth
        const availHeight = window.innerHeight - 200 // viewport menos chrome (header + padding)
        // Hoja debe entrar por ancho y alto manteniendo aspecto Letter
        const renderWidth = Math.min(colWidth, availHeight * PAGE_ASPECT, PAGE_W)
        setDocScale(renderWidth / PAGE_W)
      }
      update()
      observerRef.current = new ResizeObserver(update)
      observerRef.current.observe(node)
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
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
  // Calidad de cada firmante: { [firmante_id]: titular_id } si firma en subrogancia.
  const [firmantesSubrogancia, setFirmantesSubrogancia] = useState<Record<number, number>>({})
  const [variables, setVariables] = useState<Record<string, string>>({})
  // Delegación de emisión: titulares en cuyo nombre este usuario puede emitir
  // (ej. la secretaria emite como el Alcalde). Vacío para la mayoría de usuarios.
  const [emisoresDelegados, setEmisoresDelegados] = useState<{ id: number; nombre: string; cargo: string | null }[]>([])
  const [emitidoEnNombreDe, setEmitidoEnNombreDe] = useState<number | ''>('')

  // Campos especiales para decretos
  const [articulos, setArticulos] = useState<ArticuloDecreto[]>([
    { id: '1', contenido: '' }
  ])
  const [distribucion, setDistribucion] = useState<DistribucionItem[]>([])
  const [fieldAlignments, setFieldAlignments] = useState<Record<string, string>>({})

  // Adjuntos PDF
  const [adjuntos, setAdjuntos] = useState<File[]>([])
  const [adjuntoError, setAdjuntoError] = useState('')

  // Plantillas personales (presets del usuario)
  const [misPlantillas, setMisPlantillas] = useState<PlantillaPersonal[]>([])
  const [savePlantillaOpen, setSavePlantillaOpen] = useState(false)
  const [nuevaPlantillaNombre, setNuevaPlantillaNombre] = useState('')
  const [savingPlantilla, setSavingPlantilla] = useState(false)

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
  }, [activeStep, esMemo, variables.contenido])

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

  // Auto-asociar expediente cuando viene desde la URL (?expediente_id=).
  // Se carga el expediente directo por id en vez de buscarlo en la lista de opciones,
  // porque esa lista solo trae los 'abierto' y un expediente recién creado está en 'borrador'.
  useEffect(() => {
    if (!expedienteIdParam || expedientesSeleccionados.length > 0) return
    let cancelado = false
    expedientesAPI.obtener(Number(expedienteIdParam))
      .then(res => { if (!cancelado && res.data) setExpedientesSeleccionados([res.data]) })
      .catch(() => { /* si falla, el usuario puede seleccionarlo manualmente */ })
    return () => { cancelado = true }
  }, [expedienteIdParam])

  const loadDatos = async () => {
    try {
      const [plantillasRes, expsRes, funcsRes, deptosRes] = await Promise.all([
        documentosAPI.getPlantillas(),
        expedientesAPI.listar({ estado: 'abierto', per_page: 100 }),
        usersAPI.funcionarios(),
        departamentosAPI.listar(),
      ])
      const deptosTodos = deptosRes.data
      const deptosActivos = deptosTodos.filter((d: Departamento) => d.activo)
      setPlantillas(plantillasRes)
      setExpedientes(expsRes.data.data)
      setFuncionarios(funcsRes.data)
      setDepartamentos(deptosActivos)

      // Las plantillas personales son opcionales: un fallo no debe romper el formulario
      try {
        setMisPlantillas(await documentosAPI.getMisPlantillas())
      } catch (e) {
        console.error('No se pudieron cargar las plantillas personales:', e)
      }

      // Emisores delegados (opcional): la mayoría de usuarios no tiene ninguno.
      try {
        setEmisoresDelegados((await documentosAPI.emisoresDelegados()).data)
      } catch (e) {
        console.error('No se pudieron cargar los emisores delegados:', e)
      }

      // Modo edición: precargar el documento existente. Se matchea la distribución contra la
      // lista COMPLETA de departamentos (incluye inactivos) para no perder asociaciones existentes.
      if (isEditMode && editId) {
        await prefillFromDocumento(Number(editId), deptosTodos)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
      setError('Error al cargar los datos necesarios')
    }
  }

  // Parsear el HTML de artículos generado (formato propio) de vuelta a estado editable
  const parseArticulosHtml = (html: string): { articulos: ArticuloDecreto[]; alineaciones: Record<string, string> } => {
    const docHtml = new DOMParser().parseFromString(html, 'text/html')
    const divs = Array.from(docHtml.body.querySelectorAll(':scope > div'))
    const alineaciones: Record<string, string> = {}
    const articulos = divs.map((div, i) => {
      // El <p> de contenido es el que tiene margin-left (el de la etiqueta "ARTÍCULO X°" no lo tiene)
      const ps = div.querySelectorAll('p')
      const contentP = (div.querySelector(':scope > p[style*="margin-left"]') as HTMLElement | null)
        || (ps[ps.length - 1] as HTMLElement | undefined)
      const id = `edit_${i}_${Date.now()}`
      const align = contentP?.style?.textAlign
      if (align) alineaciones[`articulo_${id}`] = align
      return { id, contenido: contentP ? contentP.innerHTML.trim() : '' }
    }).filter(a => a.contenido)
    return { articulos, alineaciones }
  }

  // Parsear el HTML de distribución de vuelta a departamentos seleccionados
  const parseDistribucionHtml = (html: string, deptos: Departamento[]): DistribucionItem[] => {
    const docHtml = new DOMParser().parseFromString(html, 'text/html')
    const nombres = Array.from(docHtml.querySelectorAll('li')).map(li => (li.textContent || '').trim()).filter(Boolean)
    return nombres
      .map(nombre => {
        const dep = deptos.find(d => d.nombre === nombre)
        return dep ? { id: dep.id, nombre: dep.nombre } : null
      })
      .filter((d): d is DistribucionItem => d !== null)
  }

  // Precargar el formulario con los datos de un documento existente (modo edición)
  const prefillFromDocumento = async (docId: number, departamentosList: Departamento[]) => {
    try {
      const res = await documentosAPI.obtener(docId)
      const doc = res.data
      if (!doc.plantilla) {
        setError('No se pudo cargar la plantilla del documento')
        return
      }
      if (doc.estado !== 'borrador') {
        setError('Solo se pueden editar documentos en estado borrador')
      }

      setSelectedPlantilla(doc.plantilla)
      setTitulo(doc.titulo || '')
      setNivelAcceso(doc.nivel_acceso || 1)
      setPalabrasClave(doc.palabras_clave || '')
      setExpedientesSeleccionados(doc.expedientes || [])
      setFirmantesSeleccionados(doc.firmantes_asignados || [])
      // Recuperar la calidad declarada (viaja en el pivot de cada firmante).
      setFirmantesSubrogancia(
        Object.fromEntries(
          (doc.firmantes_asignados || [])
            .filter((f) => f.pivot?.subrogando_a_user_id)
            .map((f) => [f.id, f.pivot!.subrogando_a_user_id as number])
        )
      )

      const cj = doc.contenido_json || {}
      const generadas = ['articulos_html', 'firmas_html', 'distribucion_html']
      const vars: Record<string, string> = {}
      Object.keys(cj).forEach(k => { if (!generadas.includes(k)) vars[k] = cj[k] })

      const aligns: Record<string, string> = {}

      // Desenvolver el wrapper de alineación de campos de decreto (vistos/texto_decreto):
      // al guardar se envuelve el valor en <div style="text-align: X;">…</div>; aquí se revierte
      // para no mostrar el div crudo en el TextField ni duplicarlo al re-guardar.
      for (const campo of ['vistos', 'texto_decreto']) {
        const valor = vars[campo]
        if (typeof valor !== 'string') continue
        const m = valor.match(/^\s*<div style="text-align:\s*([^;"]+);?">([\s\S]*)<\/div>\s*$/)
        if (m) {
          aligns[campo] = m[1].trim()
          vars[campo] = m[2]
        }
      }
      setVariables(vars)

      if (cj.articulos_html) {
        const { articulos: arts, alineaciones } = parseArticulosHtml(cj.articulos_html)
        if (arts.length > 0) setArticulos(arts)
        Object.assign(aligns, alineaciones)
      }
      setFieldAlignments(aligns)

      if (cj.distribucion_html) {
        setDistribucion(parseDistribucionHtml(cj.distribucion_html, departamentosList))
      }

      setActiveStep(1)
    } catch (err) {
      console.error('Error cargando documento para editar:', err)
      setError('No se pudo cargar el documento para editar')
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

    // Auto-llenar remitente en memorándum: con el titular si se emite en su
    // nombre (delegación), o con el usuario logueado en caso normal.
    const esMemoPlantilla = plantilla.codigo === 'PLT_MEMO_001' || plantilla.codigo.toLowerCase().includes('memo')
    if (esMemoPlantilla) {
      const titular = emitidoEnNombreDe ? emisoresDelegados.find(t => t.id === emitidoEnNombreDe) : null
      if (titular) {
        varsIniciales['de'] = titular.nombre + (titular.cargo ? `\n${titular.cargo}` : '')
      } else if (user) {
        varsIniciales['de'] = user.nombre + (user.cargo ? `\n${user.cargo}` : '')
      }
    }

    setVariables(varsIniciales)
    setActiveStep(1)
  }

  // Elegir en nombre de quién se emite: prellena el "DE:" con el titular (o con
  // el usuario propio) y lo preasigna como firmante (quien emite es quien firma).
  const handleEmisorChange = (titularId: number | '') => {
    setEmitidoEnNombreDe(titularId)
    const titular = titularId === '' ? null : emisoresDelegados.find(t => t.id === titularId)
    const deTexto = titular
      ? titular.nombre + (titular.cargo ? `\n${titular.cargo}` : '')
      : (user ? user.nombre + (user.cargo ? `\n${user.cargo}` : '') : '')
    setVariables(prev => ({ ...prev, de: deTexto }))
    if (titular) {
      const titularUser = funcionarios.find(f => f.id === titularId)
      setFirmantesSeleccionados(titularUser ? [titularUser] : [])
    }
  }

  // Seleccionar una plantilla personal (preset): carga la plantilla base y prellena el formulario
  const handleSelectPlantillaPersonal = (preset: PlantillaPersonal) => {
    if (!preset.plantilla_base) {
      setError('La plantilla base de este preset ya no está disponible')
      return
    }
    setSelectedPlantilla(preset.plantilla_base)

    const c = preset.contenido_json || {}
    setVariables(c.variables || {})
    setArticulos(c.articulos && c.articulos.length > 0 ? c.articulos : [{ id: '1', contenido: '' }])
    setDistribucion(c.distribucion || [])
    setFieldAlignments(c.field_alignments || {})

    const ids = c.firmantes_ids || []
    setFirmantesSeleccionados(funcionarios.filter(f => ids.includes(f.id)))

    setActiveStep(1)
  }

  // Eliminar una plantilla personal
  const handleEliminarPlantillaPersonal = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await documentosAPI.eliminarPlantillaPersonal(id)
      setMisPlantillas(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Error eliminando plantilla personal:', err)
      setError('No se pudo eliminar la plantilla')
    }
  }

  // Manejo de adjuntos PDF (solo PDF, máx 10MB)
  const handleAdjuntosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // permitir volver a seleccionar el mismo archivo
    if (files.length === 0) return

    const esPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    const noPdf = files.filter(f => !esPdf(f))
    const pdfs = files.filter(esPdf)
    const grandes = pdfs.filter(f => f.size > 10 * 1024 * 1024)
    const validos = pdfs.filter(f => f.size <= 10 * 1024 * 1024)

    if (noPdf.length > 0) {
      setAdjuntoError('Solo se permiten archivos PDF')
    } else if (grandes.length > 0) {
      setAdjuntoError('Cada archivo debe pesar máximo 10 MB')
    } else {
      setAdjuntoError('')
    }

    if (validos.length > 0) {
      setAdjuntos(prev => [...prev, ...validos])
    }
  }

  const removeAdjunto = (idx: number) => {
    setAdjuntos(prev => prev.filter((_, i) => i !== idx))
  }

  // Construir el estado del formulario para guardarlo como plantilla personal
  const construirContenidoPreset = (): PlantillaPersonalContenido => ({
    variables,
    articulos: esDecreto ? articulos : undefined,
    distribucion: usaDistribucion ? distribucion : undefined,
    firmantes_ids: firmantesSeleccionados.map(f => f.id),
    field_alignments: fieldAlignments,
  })

  // Guardar el documento actual como plantilla personal
  const handleGuardarPlantilla = async () => {
    if (!selectedPlantilla || !nuevaPlantillaNombre.trim()) return
    setSavingPlantilla(true)
    try {
      await documentosAPI.guardarPlantillaPersonal({
        nombre: nuevaPlantillaNombre.trim(),
        plantilla_id: selectedPlantilla.id,
        contenido_json: construirContenidoPreset(),
      })
      setSavePlantillaOpen(false)
      setNuevaPlantillaNombre('')
      setSuccess('Plantilla personal guardada exitosamente')
      const mp = await documentosAPI.getMisPlantillas()
      setMisPlantillas(mp)
    } catch (err) {
      console.error('Error guardando plantilla personal:', err)
      setError('No se pudo guardar la plantilla personal')
    } finally {
      setSavingPlantilla(false)
    }
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
      <div style="display: flex; justify-content: flex-start; gap: 0; margin: 40px 0;">
        ${fila.map(user => {
          // El preview debe mostrar el mismo texto que quedará en el sello: si
          // firma en subrogancia, va el cargo SUBROGADO con "(S)".
          const titularId = firmantesSubrogancia[user.id]
          const titular = user.subrogaciones_vigentes?.find(t => t.id === titularId)
          const cargo = titularId
            ? `${titular?.cargo || user.cargo || ''} (S)`.trim()
            : (user.cargo || '')
          return `
          <div style="text-align: left; width: 33.33%; padding-right: 24px; box-sizing: border-box;">
            <div style="border-bottom: 1px solid #000; width: 80%; margin-bottom: 6px;"></div>
            <p style="margin: 0 0 2px 0;"><strong>${user.nombre}</strong></p>
            <p style="margin: 0; font-size: 10pt; color: #666;">${user.rut}</p>
            ${cargo ? `<p style="margin: 0; font-size: 10pt; color: #666;">${cargo}</p>` : ''}
          </div>
        `}).join('')}
      </div>
    `).join('')
  }, [firmantesSeleccionados, firmantesSubrogancia])

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
      setPreviewFull(!!response.full)
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

    if (expedientesSeleccionados.length === 0) {
      setError('Debe asociar el documento a al menos un expediente')
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

      // Modo edición: actualizar el documento existente
      if (isEditMode && editId) {
        await documentosAPI.actualizar(Number(editId), {
          titulo,
          plantilla_id: selectedPlantilla.id,
          tipo_documental_id: selectedPlantilla.tipo_documental_id,
          nivel_acceso: nivelAcceso,
          contenido_json: variablesFinales,
          palabras_clave: palabrasClave || undefined,
          expedientes_ids: expedientesSeleccionados.map(e => e.id),
          firmantes_asignados: firmantesSeleccionados.map(f => f.id),
          firmantes_subrogancia: firmantesSubrogancia,
          firmas_requeridas: firmantesSeleccionados.length || undefined,
        })

        // Subir adjuntos nuevos al documento existente
        let fallidosEdit = 0
        for (const file of adjuntos) {
          try {
            await documentosAPI.subirAdjunto(Number(editId), file)
          } catch (err) {
            fallidosEdit++
            console.error(`Error subiendo adjunto ${file.name}:`, err)
          }
        }
        setSuccess(fallidosEdit > 0
          ? `Cambios guardados. ${fallidosEdit} adjunto(s) no se pudieron subir.`
          : 'Cambios guardados exitosamente')

        setTimeout(() => {
          navigate(`/documentos/${editId}`)
        }, 1200)
        return
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
        firmantes_subrogancia: firmantesSubrogancia,
        firmas_requeridas: firmantesSeleccionados.length || undefined,
        emitido_en_nombre_de_id: emitidoEnNombreDe || undefined,
      }

      const response = await documentosAPI.crear(data)
      const nuevoId = response.data.id

      // Subir adjuntos PDF (secuencial; si alguno falla, continúa con el resto)
      if (adjuntos.length > 0) {
        let fallidos = 0
        for (const file of adjuntos) {
          try {
            await documentosAPI.subirAdjunto(nuevoId, file)
          } catch (err) {
            fallidos++
            console.error(`Error subiendo adjunto ${file.name}:`, err)
          }
        }
        setSuccess(fallidos > 0
          ? `Documento guardado. ${fallidos} adjunto(s) no se pudieron subir.`
          : 'Documento y adjuntos guardados exitosamente')
      } else {
        setSuccess('Documento guardado como borrador exitosamente')
      }

      setTimeout(() => {
        navigate(`/documentos/${nuevoId}`)
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
    <Box>
      {/* Plantillas personales (presets del usuario) */}
      {misPlantillas.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Mis Plantillas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Plantillas personales guardadas con valores prellenados.
          </Typography>
          <Grid container spacing={3}>
            {misPlantillas.map(preset => (
              <Grid item xs={12} sm={6} md={4} key={`preset-${preset.id}`}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid #e0e0e0',
                    '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
                  }}
                  onClick={() => handleSelectPlantillaPersonal(preset)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <BookmarkIcon color="primary" fontSize="small" />
                        <Typography variant="h6" noWrap title={preset.nombre}>
                          {preset.nombre}
                        </Typography>
                      </Box>
                      <Tooltip title="Eliminar plantilla">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => handleEliminarPlantillaPersonal(preset.id, e)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Basada en: {preset.plantilla_base?.nombre || 'Plantilla no disponible'}
                    </Typography>
                    {preset.plantilla_base?.tipo_documental && (
                      <Chip
                        label={preset.plantilla_base.tipo_documental.nombre}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Divider sx={{ mt: 4 }} />
        </Box>
      )}

      {misPlantillas.length > 0 && (
        <Typography variant="h6" gutterBottom>
          Plantillas del Sistema
        </Typography>
      )}
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
    </Box>
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
        <Grid item xs={12} key={key}>
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
        <Grid item xs={12} key={key}>
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

    const esMultilinea = [
      'vistos', 'contenido', 'objeto', 'obligaciones', 'vigencia', 'considerando',
      'resuelvo', 'texto_decreto', 'antecedentes', 'desarrollo', 'conclusiones',
      'recomendaciones', 'asistentes', 'temas_tratados', 'acuerdos',
    ].includes(key)

    // Overrides para decreto y memo
    const esNumeroEspecial = (esDecreto || esMemo) && key === 'numero'
    const esTextoDecreto = esDecreto && key === 'texto_decreto'
    const tieneAlineacion = esDecreto && ['vistos', 'texto_decreto'].includes(key)

    let label = descripcion || key
    if (esDecreto && key === 'numero') label = 'Número de decreto'
    if (esMemo && key === 'numero') label = 'Número de memorándum'
    if (esTextoDecreto) label = 'DECRETO'

    return (
      <Grid item xs={12} key={key}>
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

  // Render N hojas carta paginadas. Cada hoja tiene márgenes propios (top/bottom/sides)
  // y un viewport interior que muestra una "ventana" de USABLE_H del contenido completo.
  const renderPaginatedPreview = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: pageCount }).map((_, i) => (
        <Box
          key={i}
          sx={{
            width: PAGE_W,
            height: PAGE_H,
            bgcolor: 'white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            position: 'relative',
            zoom: docScale,
            fontFamily: 'serif',
            fontSize: '12pt',
            lineHeight: 1.5,
            flexShrink: 0,
          }}
        >
          {/* Viewport: área de contenido dentro de los márgenes de la hoja */}
          <Box
            sx={{
              position: 'absolute',
              top: PAD_T,
              left: PAD_L,
              width: USABLE_W,
              height: USABLE_H,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                marginTop: `${-i * USABLE_H}px`,
                width: USABLE_W,
                '& > div': {
                  maxWidth: '100% !important',
                  padding: '0 !important',
                  margin: '0 !important',
                },
                // Convertir position:fixed (usado por dompdf para QR en cada hoja)
                // a position:absolute para que el QR quede pegado al viewport en el preview.
                '& [style*="position:fixed"], & [style*="position: fixed"]': {
                  position: 'absolute !important',
                },
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  )

  // Previa del motor por bloques (Fase 2): el backend devuelve un documento HTML
  // completo, que se muestra en un iframe escalado a hoja (proporcional al PDF).
  const renderBloquesPreview = () => (
    <iframe
      title="preview-bloques"
      srcDoc={buildPreviewDoc(previewHtml, 'carta', true)}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
    />
  )

  // Renderizar paso 2: Completar datos (split layout: form izquierda, preview derecha sticky)
  const renderStep2 = () => {
    if (!selectedPlantilla) return null

    const formContent = (
      <Grid container spacing={3}>
        {/* Datos generales */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Datos Generales
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            required
            label="Título del documento"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Decreto sobre modificación presupuestaria"
          />
        </Grid>

        <Grid item xs={12}>
          {expedienteDesdeParam ? (
            <TextField
              fullWidth
              label="Expediente"
              value={expedientesSeleccionados.length > 0
                ? `${expedientesSeleccionados[0].identificador || expedientesSeleccionados[0].numero_expediente || ''} - ${expedientesSeleccionados[0].titulo}`
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
                  required
                  label="Expedientes"
                  placeholder="Buscar expediente..."
                  helperText="Todo documento debe asociarse a al menos un expediente"
                  error={expedientesSeleccionados.length === 0}
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

        <Grid item xs={12}>
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

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Palabras clave"
            value={palabrasClave}
            onChange={(e) => setPalabrasClave(e.target.value)}
            placeholder="Separadas por comas"
          />
        </Grid>

        {/* Emitir en nombre de (delegación de emisión) */}
        {emisoresDelegados.length > 0 && (
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <TextField
              select
              fullWidth
              label="Emitir en nombre de"
              value={emitidoEnNombreDe}
              onChange={(e) => handleEmisorChange(e.target.value === '' ? '' : Number(e.target.value))}
              helperText={emitidoEnNombreDe
                ? 'El documento saldrá a nombre de esta persona (DE:) y quedará asignada como firmante.'
                : 'Puedes emitir este documento en nombre de otra persona que te haya autorizado.'}
            >
              <MenuItem value="">Yo mismo{user?.nombre ? ` (${user.nombre})` : ''}</MenuItem>
              {emisoresDelegados.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.nombre}{t.cargo ? ` · ${t.cargo}` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}

        {/* Firmantes */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Firmantes Asignados
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <SelectorFirmantes
            funcionarios={funcionarios}
            firmantes={firmantesSeleccionados}
            subrogancias={firmantesSubrogancia}
            onChange={(nuevos, calidades) => {
              setFirmantesSeleccionados(nuevos)
              setFirmantesSubrogancia(calidades)
            }}
          />
        </Grid>

        {/* Adjuntos PDF */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">Documentos adjuntos (PDF)</Typography>
            <Button component="label" startIcon={<AttachFileIcon />} variant="outlined" size="small">
              Adjuntar PDF
              <input type="file" hidden accept="application/pdf" multiple onChange={handleAdjuntosChange} />
            </Button>
          </Box>
          {adjuntoError && (
            <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setAdjuntoError('')}>
              {adjuntoError}
            </Alert>
          )}
          {adjuntos.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Sin adjuntos. Puedes adjuntar uno o más archivos PDF (máx. 10 MB c/u).
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {adjuntos.map((file, idx) => (
                <Paper
                  key={`${file.name}-${idx}`}
                  variant="outlined"
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <PdfIcon color="error" fontSize="small" />
                    <Typography variant="body2" noWrap title={file.name}>{file.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </Typography>
                  </Box>
                  <IconButton size="small" color="error" onClick={() => removeAdjunto(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Paper>
              ))}
            </Box>
          )}
        </Grid>

        {/* Campos cortos de la plantilla (los largos van al final, full-width) */}
        {(() => {
          const order = FIELD_ORDER[selectedPlantilla.codigo] || Object.keys(selectedPlantilla.variables_json || {})
          const shortKeys = order.filter(
            (k) => selectedPlantilla.variables_json?.[k] && !LONG_TEXT_FIELDS.has(k)
          )
          if (shortKeys.length === 0) return null
          return (
            <>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Campos de la Plantilla
                </Typography>
              </Grid>
              {shortKeys.map((key) => renderVariableField(key, selectedPlantilla.variables_json![key] as string))}
            </>
          )
        })()}

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
      </Grid>
    )

    const previewContent = (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Previsualización
          </Typography>
          <Button
            startIcon={previewLoading ? <CircularProgress size={16} /> : <PreviewIcon />}
            onClick={handlePreview}
            variant="outlined"
            size="small"
            disabled={previewLoading}
          >
            Actualizar
          </Button>
        </Box>
        {/* Wrapper toma el ancho de la columna; sirve para medir el ancho disponible */}
        <Box ref={previewContainerRef} sx={{ width: '100%' }}>
          {/* Contenedor gris ajustado a 1 hoja; las hojas siguientes se ven al scrollear */}
          <Box
            sx={{
              width: PAGE_W * docScale + 16,
              height: PAGE_H * docScale + 16,
              maxWidth: '100%',
              mx: 'auto',
              bgcolor: '#e0e0e0',
              borderRadius: 1,
              p: 1,
              overflow: 'auto',
            }}
          >
            {previewHtml ? (previewFull ? renderBloquesPreview() : renderPaginatedPreview()) : (
              <Typography color="text.secondary" sx={{ textAlign: 'center', pt: 10 }}>
                Complete los campos para ver la previsualización
              </Typography>
            )}
          </Box>
        </Box>
        {/* Div oculto para medir el alto real del contenido renderizado al ancho útil de la hoja */}
        {previewHtml && !previewFull && (
          <Box
            ref={measureRef}
            sx={{
              position: 'absolute',
              top: -99999,
              left: -99999,
              width: USABLE_W,
              visibility: 'hidden',
              fontFamily: 'serif',
              fontSize: '12pt',
              lineHeight: 1.5,
              '& > div': {
                maxWidth: '100% !important',
                padding: '0 !important',
                margin: '0 !important',
              },
            }}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </Box>
    )

    // Sección full-width con campos largos (textareas) + artículos del decreto.
    // Va debajo del split layout y "pasa por debajo" del visualizador.
    const order = FIELD_ORDER[selectedPlantilla.codigo] || Object.keys(selectedPlantilla.variables_json || {})
    const longKeys = order.filter(
      (k) => selectedPlantilla.variables_json?.[k] && LONG_TEXT_FIELDS.has(k)
    )
    const tieneContenidoExtenso = longKeys.length > 0 || esDecreto

    const longContent = tieneContenidoExtenso ? (
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Contenido del Documento
          </Typography>
        </Grid>

        {esDecreto ? (
          <>
            {/* Vistos primero (long, antes de artículos) */}
            {longKeys
              .filter((k) => k !== 'texto_decreto')
              .map((k) => renderVariableField(k, selectedPlantilla.variables_json![k] as string))}

            {/* Artículos del Decreto */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">Artículos del Decreto</Typography>
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

            {/* Texto del decreto al final */}
            {selectedPlantilla.variables_json?.['texto_decreto'] &&
              renderVariableField('texto_decreto', selectedPlantilla.variables_json['texto_decreto'] as string)}
          </>
        ) : (
          longKeys.map((k) => renderVariableField(k, selectedPlantilla.variables_json![k] as string))
        )}
      </Grid>
    ) : null

    return (
      <Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={5} lg={4}>
            {formContent}
          </Grid>
          <Grid item xs={12} md={7} lg={8}>
            <Box
              sx={{
                position: { md: 'sticky' },
                top: { md: 80 },
              }}
            >
              {previewContent}
            </Box>
          </Grid>
        </Grid>
        {longContent}
      </Box>
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
        <Box ref={previewContainerRef} sx={{ width: '100%' }}>
          <Box
            sx={{
              width: PAGE_W * docScale + 16,
              height: PAGE_H * docScale + 16,
              maxWidth: '100%',
              mx: 'auto',
              bgcolor: '#e0e0e0',
              borderRadius: 1,
              p: 1,
              overflow: 'auto',
            }}
          >
            {previewHtml ? (previewFull ? renderBloquesPreview() : renderPaginatedPreview()) : (
              <Typography color="text.secondary" sx={{ textAlign: 'center', pt: 10 }}>
                Sin previsualización
              </Typography>
            )}
          </Box>
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
          {isEditMode ? 'Editar Documento' : 'Nuevo Documento'}
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
                // En modo edición la plantilla es fija: no se puede volver al paso 0
                if (isEditMode && index === 0) return
                if (index < activeStep || (index === 1 && selectedPlantilla)) {
                  setActiveStep(index)
                }
              }}
              sx={{ cursor: (isEditMode && index === 0) ? 'default' : (index <= activeStep ? 'pointer' : 'default') }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Contenido del paso */}
      <Card>
        <CardContent>
          {isEditMode && !selectedPlantilla ? (
            error ? null : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            )
          ) : (
            <>
              {activeStep === 0 && renderStep1()}
              {activeStep === 1 && renderStep2()}
              {activeStep === 2 && renderStep3()}
            </>
          )}

          {/* Navegación */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: '1px solid #e0e0e0' }}>
            <Button
              disabled={activeStep === 0 || (isEditMode && activeStep === 1)}
              onClick={() => setActiveStep(prev => prev - 1)}
            >
              Anterior
            </Button>

            <Box sx={{ display: 'flex', gap: 2 }}>
              {(activeStep === 1 || activeStep === 2) && selectedPlantilla && (
                <Button
                  variant="outlined"
                  startIcon={<BookmarkAddIcon />}
                  onClick={() => setSavePlantillaOpen(true)}
                >
                  Guardar como plantilla
                </Button>
              )}

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
                  {isEditMode ? 'Guardar cambios' : 'Guardar como Borrador'}
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Diálogo: guardar como plantilla personal */}
      <Dialog open={savePlantillaOpen} onClose={() => setSavePlantillaOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Guardar como plantilla personal</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Se guardarán los valores actuales del formulario como una plantilla personal reutilizable.
            Solo tú podrás verla y usarla en futuros documentos.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Nombre de la plantilla"
            value={nuevaPlantillaNombre}
            onChange={(e) => setNuevaPlantillaNombre(e.target.value)}
            placeholder="Ej: Memo mensual finanzas"
            inputProps={{ maxLength: 150 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSavePlantillaOpen(false)} disabled={savingPlantilla}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGuardarPlantilla}
            disabled={savingPlantilla || !nuevaPlantillaNombre.trim()}
            startIcon={savingPlantilla ? <CircularProgress size={16} /> : <BookmarkAddIcon />}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default DocumentoNew
