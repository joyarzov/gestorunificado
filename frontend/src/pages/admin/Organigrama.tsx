import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Avatar,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Drawer,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Menu,
  Alert,
  Snackbar,
  Tooltip,
} from '@mui/material'
import {
  Close as CloseIcon,
  Add as AddIcon,
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
  AccountTree as TreeIcon,
  SwapHoriz as SwapIcon,
  PersonAdd as AssignIcon,
  Edit as EditIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
  CenterFocusStrong as CenterIcon,
  ExpandMore as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material'
import { organigramaAPI, OrganigramaNodo } from '../../api/organigrama'
import { usersAPI } from '../../api/common'
import { User } from '../../types'
import { useAuth } from '../../contexts/AuthContext'

/* -------------------------------------------------------------------------- */
/*  Node visual                                                                */
/* -------------------------------------------------------------------------- */

const tipoColor: Record<string, string> = {
  alcaldia: '#0071BC',
  administracion: '#28A9E3',
  direccion: '#8AC53E',
  departamento: '#EE5825',
  seccion: '#EB1B78',
  asesor: '#9e9e9e',
}

const tipoLabel: Record<string, string> = {
  alcaldia: 'Alcaldía',
  administracion: 'Administración',
  direccion: 'Dirección',
  departamento: 'Departamento',
  seccion: 'Sección',
  asesor: 'Asesor',
}

interface DepartamentoNodeData {
  nodo: OrganigramaNodo
  onMenu: (nodo: OrganigramaNodo, anchor: HTMLElement) => void
  onSelect: (nodo: OrganigramaNodo) => void
  onToggleCollapse: (id: number) => void
  seleccionado: boolean
  tieneHijos: boolean
  colapsado: boolean
  hijosCount: number
}

const DepartamentoNode = ({ data }: NodeProps<DepartamentoNodeData>) => {
  const { nodo, onMenu, onSelect, onToggleCollapse, seleccionado, tieneHijos, colapsado, hijosCount } = data
  const color = tipoColor[nodo.tipo ?? 'departamento'] ?? '#607d8b'

  return (
    <Box
      onClick={() => onSelect(nodo)}
      sx={{
        width: 210,
        position: 'relative',
        bgcolor: '#fff',
        borderLeft: `3px solid ${color}`,
        border: '1px solid',
        borderColor: seleccionado ? color : '#d9dde3',
        borderRadius: 1.5,
        boxShadow: seleccionado ? 3 : 0,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        '&:hover': { boxShadow: 2, borderColor: color },
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color, border: 'none', width: 6, height: 6 }} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.5,
          px: 1,
          pt: 0.75,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontSize: 9.5,
            lineHeight: 1,
          }}
        >
          {tipoLabel[nodo.tipo ?? 'departamento'] ?? 'Unidad'}
        </Typography>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            onMenu(nodo, e.currentTarget)
          }}
          sx={{ p: 0.25, color: '#94a3b8' }}
        >
          <MoreVertIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>
      <Box sx={{ px: 1, pb: 0.75 }}>
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{
            color: '#1a2330',
            lineHeight: 1.2,
            fontSize: 12.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {nodo.nombre}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
          {nodo.jefe ? (
            <>
              <Avatar sx={{ width: 18, height: 18, fontSize: 10, bgcolor: color }}>
                {nodo.jefe.nombre.charAt(0)}
              </Avatar>
              <Typography variant="caption" noWrap sx={{ fontSize: 11, color: '#4a5568', flex: 1 }}>
                {nodo.jefe.nombre}
              </Typography>
            </>
          ) : (
            <Typography variant="caption" sx={{ fontSize: 10.5, color: '#94a3b8', fontStyle: 'italic', flex: 1 }}>
              Sin jefatura
            </Typography>
          )}
          {nodo.integrantes.length > 0 && (
            <Typography variant="caption" sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
              <PersonIcon sx={{ fontSize: 11, verticalAlign: 'text-bottom', mr: 0.25 }} />
              {nodo.integrantes.length}
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Botón expandir/colapsar para nodos con hijos */}
      {tieneHijos && (
        <Tooltip title={colapsado ? `Expandir ${hijosCount} sub-unidad${hijosCount === 1 ? '' : 'es'}` : 'Colapsar rama'}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse(nodo.id)
            }}
            sx={{
              position: 'absolute',
              bottom: -11,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: '#fff',
              border: `1px solid ${color}`,
              width: 22,
              height: 22,
              color,
              zIndex: 2,
              '&:hover': { bgcolor: color, color: '#fff' },
            }}
          >
            {colapsado ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ChevronDownIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: color, border: 'none', width: 6, height: 6 }} />
    </Box>
  )
}

const nodeTypes = { departamento: DepartamentoNode }

/* -------------------------------------------------------------------------- */
/*  Auto-layout con dagre                                                      */
/* -------------------------------------------------------------------------- */

const NODE_W = 210
const NODE_H = 70

function layoutNodos(nodos: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 34, ranksep: 64, marginx: 15, marginy: 15 })

  nodos.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodos.map((n) => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    }
  })
}

/* -------------------------------------------------------------------------- */
/*  Página principal                                                           */
/* -------------------------------------------------------------------------- */

const OrganigramaInner = () => {
  const [organigrama, setOrganigrama] = useState<OrganigramaNodo[]>([])
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState<OrganigramaNodo | null>(null)

  // Menú contextual del nodo
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuNodo, setMenuNodo] = useState<OrganigramaNodo | null>(null)

  // Diálogos
  const [dialogTipo, setDialogTipo] = useState<'crear' | 'editar' | 'asignar-jefe' | 'mover' | 'mover-funcionario' | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formCodigo, setFormCodigo] = useState('')
  const [formTipo, setFormTipo] = useState('departamento')
  const [formParentId, setFormParentId] = useState<number | null>(null)
  const [formJefeId, setFormJefeId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Mover funcionario
  const [funcionarioAMover, setFuncionarioAMover] = useState<{ id: number; nombre: string } | null>(null)
  const [nuevoDeptoId, setNuevoDeptoId] = useState<number | ''>('')

  // Estado de colapso: set de IDs cuyos hijos están ocultos
  const [colapsados, setColapsados] = useState<Set<number>>(new Set())

  const { isAdmin } = useAuth()
  const esAdmin = isAdmin()

  const toggleCollapse = useCallback((id: number) => {
    setColapsados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const { fitView } = useReactFlow()
  const fitTriggered = useRef(false)

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      const [orgRes, userRes] = await Promise.all([
        organigramaAPI.obtener(),
        usersAPI.funcionarios(),
      ])
      setOrganigrama(orgRes.data ?? [])
      setUsuarios(userRes.data ?? [])
    } catch (err) {
      console.error(err)
      setSnack({ msg: 'No se pudo cargar el organigrama', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const handleAbrirMenu = (nodo: OrganigramaNodo, anchor: HTMLElement) => {
    setMenuNodo(nodo)
    setMenuAnchor(anchor)
  }
  const handleCerrarMenu = () => {
    setMenuAnchor(null)
  }

  // Mapeo padre → hijos para calcular ocultos y hasChildren
  const hijosPorPadre = useMemo(() => {
    const map = new Map<number, OrganigramaNodo[]>()
    organigrama.forEach((n) => {
      if (n.parent_id != null) {
        if (!map.has(n.parent_id)) map.set(n.parent_id, [])
        map.get(n.parent_id)!.push(n)
      }
    })
    return map
  }, [organigrama])

  // IDs de nodos ocultos: descendientes (transitivos) de nodos colapsados
  const ocultos = useMemo(() => {
    const hidden = new Set<number>()
    const ocultar = (id: number) => {
      const children = hijosPorPadre.get(id) ?? []
      for (const c of children) {
        hidden.add(c.id)
        ocultar(c.id)
      }
    }
    colapsados.forEach((id) => ocultar(id))
    return hidden
  }, [colapsados, hijosPorPadre])

  const organigramaVisible = useMemo(
    () => organigrama.filter((n) => !ocultos.has(n.id)),
    [organigrama, ocultos]
  )

  const edges: Edge[] = useMemo(
    () => {
      // Color de cada conector = color del padre (según su tipo). Así se distingue
      // fácilmente de qué unidad "cuelga" cada línea cuando se fusionan varias.
      const tipoPorId = new Map(organigramaVisible.map((n) => [n.id, n.tipo]))
      return organigramaVisible
        .filter((n) => n.parent_id !== null && n.parent_id !== undefined && !ocultos.has(n.parent_id))
        .map((n) => {
          const colorPadre = tipoColor[tipoPorId.get(n.parent_id as number) ?? 'departamento'] ?? '#9aa3b0'
          return {
            id: `e-${n.parent_id}-${n.id}`,
            source: String(n.parent_id),
            target: String(n.id),
            type: 'smoothstep',
            pathOptions: { borderRadius: 12 },
            style: { stroke: colorPadre, strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: colorPadre, width: 16, height: 16 },
          }
        })
    },
    [organigramaVisible, ocultos]
  )

  const nodes: Node[] = useMemo(() => {
    const raw = organigramaVisible.map<Node>((nodo) => {
      const hijos = hijosPorPadre.get(nodo.id) ?? []
      return {
        id: String(nodo.id),
        type: 'departamento',
        position: { x: 0, y: 0 },
        data: {
          nodo,
          onMenu: handleAbrirMenu,
          onSelect: setSeleccionado,
          onToggleCollapse: toggleCollapse,
          seleccionado: seleccionado?.id === nodo.id,
          tieneHijos: hijos.length > 0,
          colapsado: colapsados.has(nodo.id),
          hijosCount: hijos.length,
        },
      }
    })
    return layoutNodos(raw, edges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organigramaVisible, seleccionado, edges, hijosPorPadre, colapsados, toggleCollapse])

  useEffect(() => {
    if (!loading && nodes.length > 0 && !fitTriggered.current) {
      setTimeout(() => fitView({ padding: 0.12, duration: 400, maxZoom: 0.9 }), 80)
      fitTriggered.current = true
    }
  }, [loading, nodes, fitView])

  // Re-centrar cuando el usuario colapsa/expande
  useEffect(() => {
    if (fitTriggered.current) {
      setTimeout(() => fitView({ padding: 0.12, duration: 300, maxZoom: 1.1 }), 50)
    }
  }, [colapsados, fitView])

  const colapsarTodo = () => {
    // Colapsar todos los nodos que tengan hijos (excepto la raíz para que se vea algo)
    const conHijos = organigrama
      .filter((n) => (hijosPorPadre.get(n.id) ?? []).length > 0)
      .filter((n) => n.parent_id !== null) // no colapsar la raíz
      .map((n) => n.id)
    setColapsados(new Set(conHijos))
  }

  const expandirTodo = () => {
    setColapsados(new Set())
  }

  const centrarVista = () => {
    fitView({ padding: 0.12, duration: 300, maxZoom: 1.1 })
  }

  /* ---------- Acciones ---------- */

  const abrirDialogCrear = (parent?: OrganigramaNodo) => {
    setFormNombre('')
    setFormCodigo('')
    setFormTipo('departamento')
    setFormParentId(parent?.id ?? null)
    setFormJefeId(null)
    setDialogTipo('crear')
  }

  const abrirDialogEditar = (nodo: OrganigramaNodo) => {
    setFormNombre(nodo.nombre)
    setFormCodigo(nodo.codigo ?? '')
    setFormTipo(nodo.tipo ?? 'departamento')
    setSeleccionado(nodo)
    setDialogTipo('editar')
  }

  const abrirDialogAsignarJefe = (nodo: OrganigramaNodo) => {
    setFormJefeId(nodo.jefe?.id ?? null)
    setSeleccionado(nodo)
    setDialogTipo('asignar-jefe')
  }

  const abrirDialogMover = (nodo: OrganigramaNodo) => {
    setFormParentId(nodo.parent_id ?? null)
    setSeleccionado(nodo)
    setDialogTipo('mover')
  }

  const abrirDialogMoverFuncionario = (userId: number, nombre: string) => {
    setFuncionarioAMover({ id: userId, nombre })
    setNuevoDeptoId(seleccionado?.id ?? '')
    setDialogTipo('mover-funcionario')
  }

  const cerrarDialog = () => {
    if (saving) return
    setDialogTipo(null)
  }

  const guardarCrear = async () => {
    if (!formNombre.trim()) {
      setSnack({ msg: 'El nombre es obligatorio', severity: 'error' })
      return
    }
    try {
      setSaving(true)
      await organigramaAPI.crearDepartamento({
        nombre: formNombre.trim(),
        codigo: formCodigo.trim() || undefined,
        parent_id: formParentId,
        tipo: formTipo,
        jefe_id: formJefeId,
      })
      setSnack({ msg: 'Departamento creado', severity: 'success' })
      setDialogTipo(null)
      await cargar()
    } catch (e: any) {
      setSnack({ msg: e?.response?.data?.message ?? 'No se pudo crear', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const guardarEditar = async () => {
    if (!seleccionado) return
    if (!formNombre.trim()) {
      setSnack({ msg: 'El nombre es obligatorio', severity: 'error' })
      return
    }
    try {
      setSaving(true)
      await organigramaAPI.actualizarDepartamento(seleccionado.id, {
        nombre: formNombre.trim(),
        codigo: formCodigo.trim() || null,
        tipo: formTipo,
      })
      setSnack({ msg: 'Unidad actualizada', severity: 'success' })
      setDialogTipo(null)
      await cargar()
    } catch (e: any) {
      setSnack({ msg: e?.response?.data?.message ?? 'No se pudo actualizar', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const guardarJefe = async () => {
    if (!seleccionado) return
    try {
      setSaving(true)
      await organigramaAPI.actualizarJefe(seleccionado.id, formJefeId)
      setSnack({ msg: 'Jefatura actualizada', severity: 'success' })
      setDialogTipo(null)
      await cargar()
    } catch (e: any) {
      setSnack({ msg: e?.response?.data?.message ?? 'No se pudo asignar', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const guardarMover = async () => {
    if (!seleccionado) return
    try {
      setSaving(true)
      await organigramaAPI.actualizarParent(seleccionado.id, formParentId)
      setSnack({ msg: 'Jerarquía actualizada', severity: 'success' })
      setDialogTipo(null)
      await cargar()
    } catch (e: any) {
      setSnack({ msg: e?.response?.data?.message ?? 'No se pudo mover', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const guardarMoverFuncionario = async () => {
    if (!funcionarioAMover || nuevoDeptoId === '') return
    if (nuevoDeptoId === seleccionado?.id) {
      setSnack({ msg: 'Ya pertenece a ese departamento', severity: 'error' })
      return
    }
    try {
      setSaving(true)
      await organigramaAPI.moverUsuario(funcionarioAMover.id, Number(nuevoDeptoId))
      setSnack({ msg: `${funcionarioAMover.nombre} fue movido`, severity: 'success' })
      setDialogTipo(null)
      setFuncionarioAMover(null)
      await cargar()
    } catch (e: any) {
      setSnack({ msg: e?.response?.data?.message ?? 'No se pudo mover el funcionario', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const deptosParaPadre = useMemo(
    () =>
      organigrama.filter((d) => {
        // No permitir mover a sí mismo ni a un descendiente
        if (!seleccionado) return true
        if (d.id === seleccionado.id) return false
        // Marcar descendientes
        const ids = new Set<number>()
        const marcar = (id: number) => {
          ids.add(id)
          organigrama.filter((x) => x.parent_id === id).forEach((h) => marcar(h.id))
        }
        marcar(seleccionado.id)
        return !ids.has(d.id)
      }),
    [organigrama, seleccionado]
  )

  /* ---------- Render ---------- */

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)' }}>
      {/* Encabezado */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1,
          mb: 2,
        }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <TreeIcon color="primary" />
            <Typography variant="h4" fontWeight="bold">
              Organigrama municipal
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Estructura jerárquica de la Ilustre Municipalidad de Cabo de Hornos
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Expandir todas las ramas">
            <Button variant="outlined" size="small" startIcon={<ExpandAllIcon />} onClick={expandirTodo}>
              Expandir todo
            </Button>
          </Tooltip>
          <Tooltip title="Colapsar ramas (muestra primer nivel)">
            <Button variant="outlined" size="small" startIcon={<CollapseAllIcon />} onClick={colapsarTodo}>
              Colapsar
            </Button>
          </Tooltip>
          <Tooltip title="Ajustar vista">
            <Button variant="outlined" size="small" startIcon={<CenterIcon />} onClick={centrarVista}>
              Ajustar
            </Button>
          </Tooltip>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => abrirDialogCrear()}>
            Nueva unidad
          </Button>
        </Stack>
      </Box>

      {/* Canvas + panel lateral */}
      <Paper
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          position: 'relative',
        }}
        elevation={1}
      >
        {loading ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ flex: 1, bgcolor: '#f4f6fa' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.12, maxZoom: 0.9 }}
                panOnScroll
                minZoom={0.4}
                maxZoom={1.6}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={20} color="#e5e7eb" />
                <Controls showInteractive={false} />
                <MiniMap pannable zoomable maskColor="rgba(15,23,42,0.08)" />
              </ReactFlow>
            </Box>

            {/* Panel lateral */}
            {seleccionado && (
              <Drawer
                anchor="right"
                open={!!seleccionado}
                onClose={() => setSeleccionado(null)}
                variant="persistent"
                sx={{
                  width: 340,
                  flexShrink: 0,
                  '& .MuiDrawer-paper': {
                    width: 340,
                    position: 'absolute',
                    height: '100%',
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                  },
                }}
              >
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600 }}>
                      {tipoLabel[seleccionado.tipo ?? 'departamento'] ?? 'Unidad'}
                    </Typography>
                    <IconButton size="small" onClick={() => setSeleccionado(null)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
                    {seleccionado.nombre}
                  </Typography>
                  {seleccionado.codigo && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {seleccionado.codigo}
                    </Typography>
                  )}
                </Box>

                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="overline" color="text.secondary">
                    Jefatura
                  </Typography>
                  {seleccionado.jefe ? (
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
                      <Avatar sx={{ bgcolor: tipoColor[seleccionado.tipo ?? 'departamento'] ?? '#0071BC' }}>
                        {seleccionado.jefe.nombre.charAt(0)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {seleccionado.jefe.nombre}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {seleccionado.jefe.cargo ?? 'Sin cargo'}
                        </Typography>
                        {seleccionado.jefe.subrogante && (
                          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.25 }}>
                            Subrogante: <strong>{seleccionado.jefe.subrogante.nombre}</strong>
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', mt: 0.5 }}>
                      Sin jefatura asignada
                    </Typography>
                  )}
                  <Button
                    size="small"
                    startIcon={<AssignIcon />}
                    onClick={() => abrirDialogAsignarJefe(seleccionado)}
                    sx={{ mt: 1 }}
                  >
                    {seleccionado.jefe ? 'Cambiar jefatura' : 'Asignar jefatura'}
                  </Button>
                </Box>

                <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
                  <Typography variant="overline" color="text.secondary">
                    Integrantes ({seleccionado.integrantes.length})
                  </Typography>
                  {seleccionado.integrantes.length === 0 ? (
                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', mt: 1 }}>
                      Sin integrantes asignados todavía.
                    </Typography>
                  ) : (
                    <List dense sx={{ mt: 0.5 }}>
                      {seleccionado.integrantes.map((i) => (
                        <ListItem
                          key={i.id}
                          disablePadding
                          sx={{ py: 0.5 }}
                          secondaryAction={
                            esAdmin ? (
                              <Tooltip title="Mover a otro departamento">
                                <IconButton
                                  edge="end"
                                  size="small"
                                  onClick={() => abrirDialogMoverFuncionario(i.id, i.nombre)}
                                >
                                  <SwapIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : null
                          }
                        >
                          <ListItemAvatar sx={{ minWidth: 40 }}>
                            <Avatar sx={{ width: 30, height: 30, fontSize: 12 }}>
                              {i.nombre.charAt(0)}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Typography variant="body2" fontWeight={i.es_jefe ? 700 : 500} noWrap>
                                  {i.nombre}
                                </Typography>
                                {i.es_jefe && <Chip label="Jefe" size="small" color="primary" sx={{ height: 16, fontSize: 9.5 }} />}
                              </Stack>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {i.cargo ?? 'Sin cargo'}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </Drawer>
            )}
          </>
        )}
      </Paper>

      {/* Menú contextual de nodo */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={handleCerrarMenu}>
        <MenuItem
          onClick={() => {
            if (menuNodo) abrirDialogEditar(menuNodo)
            handleCerrarMenu()
          }}
        >
          <EditIcon sx={{ fontSize: 18, mr: 1 }} /> Editar datos
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuNodo) abrirDialogAsignarJefe(menuNodo)
            handleCerrarMenu()
          }}
        >
          <AssignIcon sx={{ fontSize: 18, mr: 1 }} /> Asignar jefatura
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuNodo) abrirDialogMover(menuNodo)
            handleCerrarMenu()
          }}
        >
          <SwapIcon sx={{ fontSize: 18, mr: 1 }} /> Mover bajo otra unidad
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuNodo) abrirDialogCrear(menuNodo)
            handleCerrarMenu()
          }}
        >
          <AddIcon sx={{ fontSize: 18, mr: 1 }} /> Agregar sub-unidad
        </MenuItem>
      </Menu>

      {/* Diálogo: crear */}
      <Dialog open={dialogTipo === 'crear'} onClose={cerrarDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva unidad organizacional</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre"
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="Código (opcional, único)"
              value={formCodigo}
              onChange={(e) => setFormCodigo(e.target.value.toUpperCase())}
              fullWidth
            />
            <TextField label="Tipo" select value={formTipo} onChange={(e) => setFormTipo(e.target.value)} fullWidth>
              {Object.entries(tipoLabel).map(([val, lab]) => (
                <MenuItem key={val} value={val}>
                  {lab}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Depende de"
              select
              value={formParentId ?? ''}
              onChange={(e) => setFormParentId(e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
            >
              <MenuItem value="">— Sin padre (nodo raíz) —</MenuItem>
              {organigrama.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Jefatura (opcional)"
              select
              value={formJefeId ?? ''}
              onChange={(e) => setFormJefeId(e.target.value === '' ? null : Number(e.target.value))}
              fullWidth
            >
              <MenuItem value="">— Sin asignar —</MenuItem>
              {usuarios.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.nombre} {u.cargo ? `· ${u.cargo}` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialog} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={guardarCrear} disabled={saving}>
            {saving ? 'Creando…' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: editar datos */}
      <Dialog open={dialogTipo === 'editar'} onClose={cerrarDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Editar unidad</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nombre"
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="Código"
              value={formCodigo}
              onChange={(e) => setFormCodigo(e.target.value.toUpperCase())}
              fullWidth
              helperText="Código abreviado único (ej: DOM, DIDECO, FIN)"
            />
            <TextField label="Tipo" select value={formTipo} onChange={(e) => setFormTipo(e.target.value)} fullWidth>
              {Object.entries(tipoLabel).map(([val, lab]) => (
                <MenuItem key={val} value={val}>
                  {lab}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialog} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={guardarEditar} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: asignar jefatura */}
      <Dialog open={dialogTipo === 'asignar-jefe'} onClose={cerrarDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Asignar jefatura</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            El subrogante de la jefatura se define en el <strong>perfil del usuario</strong>, no aquí.
          </Alert>
          <TextField
            label="Jefe de la unidad"
            select
            value={formJefeId ?? ''}
            onChange={(e) => setFormJefeId(e.target.value === '' ? null : Number(e.target.value))}
            fullWidth
          >
            <MenuItem value="">— Sin jefatura —</MenuItem>
            {usuarios.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.nombre} {u.cargo ? `· ${u.cargo}` : ''}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialog} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={guardarJefe} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: mover bajo otra unidad */}
      <Dialog open={dialogTipo === 'mover'} onClose={cerrarDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Mover "{seleccionado?.nombre}" bajo otra unidad</DialogTitle>
        <DialogContent>
          <TextField
            label="Nuevo padre"
            select
            value={formParentId ?? ''}
            onChange={(e) => setFormParentId(e.target.value === '' ? null : Number(e.target.value))}
            fullWidth
            helperText="No puedes moverlo dentro de sí mismo ni de sus descendientes."
          >
            <MenuItem value="">— Nodo raíz (sin padre) —</MenuItem>
            {deptosParaPadre.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.nombre}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialog} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={guardarMover} disabled={saving}>
            {saving ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: mover funcionario a otro departamento */}
      <Dialog
        open={dialogTipo === 'mover-funcionario'}
        onClose={cerrarDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Mover a {funcionarioAMover?.nombre}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Esta acción solo cambia el departamento del funcionario. No modifica su rol, cargo ni permisos.
          </Alert>
          <TextField
            label="Departamento destino"
            select
            value={nuevoDeptoId}
            onChange={(e) => setNuevoDeptoId(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
          >
            <MenuItem value="">— Sin departamento —</MenuItem>
            {organigrama.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.nombre}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={cerrarDialog} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={guardarMoverFuncionario} disabled={saving || nuevoDeptoId === ''}>
            {saving ? 'Moviendo…' : 'Mover'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}

const Organigrama = () => (
  <ReactFlowProvider>
    <OrganigramaInner />
  </ReactFlowProvider>
)

export default Organigrama
