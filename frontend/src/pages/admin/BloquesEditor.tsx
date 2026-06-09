import { useState } from 'react'
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  IconButton,
  Button,
  Menu,
  Paper,
  Divider,
  Stack,
  Tooltip,
  Collapse,
} from '@mui/material'
import {
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
  DeleteOutline as DeleteIcon,
  Add as AddIcon,
  Tune as PropsIcon,
} from '@mui/icons-material'
import { BloquePlantilla, EstiloPlantilla } from '../../types'

const CATALOGO: { tipo: string; label: string }[] = [
  { tipo: 'barra_colores', label: 'Barra de colores' },
  { tipo: 'membrete', label: 'Membrete (logo + institución)' },
  { tipo: 'titulo', label: 'Título' },
  { tipo: 'ref_fecha', label: 'Referencia / fecha' },
  { tipo: 'seccion', label: 'Sección (título + cuerpo)' },
  { tipo: 'parrafo', label: 'Párrafo' },
  { tipo: 'qr_pie', label: 'Pie con QR' },
]
const labelDe = (tipo: string) => CATALOGO.find((c) => c.tipo === tipo)?.label || tipo

const TAMANOS = ['10pt', '11pt', '12pt', '13pt', '14pt']

interface Props {
  estructura: BloquePlantilla[]
  onEstructuraChange: (b: BloquePlantilla[]) => void
  estilo: EstiloPlantilla
  onEstiloChange: (e: EstiloPlantilla) => void
  variables: string[]
}

const BloquesEditor = ({ estructura, onEstructuraChange, estilo, onEstiloChange, variables }: Props) => {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null)

  // ---- estructura ----
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= estructura.length) return
    const copy = [...estructura]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    onEstructuraChange(copy)
  }
  const remove = (i: number) => onEstructuraChange(estructura.filter((_, idx) => idx !== i))
  const addBloque = (tipo: string) => {
    onEstructuraChange([...estructura, { tipo, props: {} }])
    setAddAnchor(null)
  }
  const setProp = (i: number, key: string, value: unknown) => {
    const copy = estructura.map((b, idx) =>
      idx === i ? { ...b, props: { ...(b.props || {}), [key]: value } } : b
    )
    onEstructuraChange(copy)
  }

  // ---- estilo ----
  const setEstilo = (patch: Partial<EstiloPlantilla>) => onEstiloChange({ ...estilo, ...patch })

  const varSelect = (i: number, key: string, label: string) => (
    <TextField
      select size="small" fullWidth label={label} sx={{ mb: 1 }}
      value={(estructura[i].props?.[key] as string) || ''}
      onChange={(e) => setProp(i, key, e.target.value)}
    >
      <MenuItem value="">— ninguna —</MenuItem>
      {variables.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
    </TextField>
  )

  const renderProps = (b: BloquePlantilla, i: number) => {
    const p = b.props || {}
    switch (b.tipo) {
      case 'titulo':
        return (
          <>
            <TextField size="small" fullWidth label="Texto (admite {{variable}})" sx={{ mb: 1 }}
              value={p.texto || ''} onChange={(e) => setProp(i, 'texto', e.target.value)} />
            <TextField select size="small" fullWidth label="Alineación"
              value={p.align || 'center'} onChange={(e) => setProp(i, 'align', e.target.value)}>
              <MenuItem value="left">Izquierda</MenuItem>
              <MenuItem value="center">Centro</MenuItem>
              <MenuItem value="right">Derecha</MenuItem>
            </TextField>
          </>
        )
      case 'ref_fecha': {
        const items: { label?: string; var?: string }[] = p.items || []
        const setItems = (it: typeof items) => setProp(i, 'items', it)
        return (
          <Stack spacing={1}>
            {items.map((it, k) => (
              <Stack direction="row" spacing={1} key={k} alignItems="center">
                <TextField size="small" label="Etiqueta" value={it.label || ''}
                  onChange={(e) => setItems(items.map((x, idx) => idx === k ? { ...x, label: e.target.value } : x))} />
                <TextField select size="small" label="Variable" sx={{ minWidth: 120 }} value={it.var || ''}
                  onChange={(e) => setItems(items.map((x, idx) => idx === k ? { ...x, var: e.target.value } : x))}>
                  <MenuItem value="">—</MenuItem>
                  {variables.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </TextField>
                <IconButton size="small" color="error" onClick={() => setItems(items.filter((_, idx) => idx !== k))}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button size="small" startIcon={<AddIcon />} onClick={() => setItems([...items, { label: '', var: '' }])}>
              Agregar línea
            </Button>
          </Stack>
        )
      }
      case 'seccion': {
        const fuente = p.var_html ? 'var_html' : p.texto !== undefined && p.var === undefined ? 'texto' : 'var'
        return (
          <>
            <TextField size="small" fullWidth label="Título de la sección (opcional)" sx={{ mb: 1 }}
              value={p.titulo || ''} onChange={(e) => setProp(i, 'titulo', e.target.value)} />
            <TextField select size="small" fullWidth label="Contenido desde" sx={{ mb: 1 }} value={fuente}
              onChange={(e) => {
                const f = e.target.value
                // limpiar las otras fuentes
                const copy = estructura.map((bl, idx) => idx === i
                  ? { ...bl, props: { ...(bl.props || {}), var: undefined, var_html: undefined, texto: undefined, [f]: f === 'texto' ? '' : '' } }
                  : bl)
                onEstructuraChange(copy)
              }}>
              <MenuItem value="var">Variable (texto)</MenuItem>
              <MenuItem value="var_html">Variable (HTML generado)</MenuItem>
              <MenuItem value="texto">Texto fijo</MenuItem>
            </TextField>
            {fuente === 'var' && varSelect(i, 'var', 'Variable')}
            {fuente === 'var_html' && varSelect(i, 'var_html', 'Variable HTML')}
            {fuente === 'texto' && (
              <TextField size="small" fullWidth multiline minRows={2} label="Texto" sx={{ mb: 1 }}
                value={p.texto || ''} onChange={(e) => setProp(i, 'texto', e.target.value)} />
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <FormControlLabel control={<Checkbox size="small" checked={!!p.indent} onChange={(e) => setProp(i, 'indent', e.target.checked)} />} label="Sangría" />
              <FormControlLabel control={<Checkbox size="small" checked={!!p.justify} onChange={(e) => setProp(i, 'justify', e.target.checked)} />} label="Justificado" />
              <FormControlLabel control={<Checkbox size="small" checked={!!p.small} onChange={(e) => setProp(i, 'small', e.target.checked)} />} label="Pequeño" />
              <FormControlLabel control={<Checkbox size="small" checked={p.titulo_align === 'center'} onChange={(e) => setProp(i, 'titulo_align', e.target.checked ? 'center' : '')} />} label="Título centrado" />
            </Stack>
          </>
        )
      }
      case 'parrafo': {
        const fuente = p.var ? 'var' : 'texto'
        return (
          <>
            <TextField select size="small" fullWidth label="Contenido desde" sx={{ mb: 1 }} value={fuente}
              onChange={(e) => {
                const f = e.target.value
                const copy = estructura.map((bl, idx) => idx === i
                  ? { ...bl, props: { ...(bl.props || {}), var: undefined, texto: undefined, [f]: '' } } : bl)
                onEstructuraChange(copy)
              }}>
              <MenuItem value="texto">Texto fijo</MenuItem>
              <MenuItem value="var">Variable</MenuItem>
            </TextField>
            {fuente === 'texto'
              ? <TextField size="small" fullWidth multiline minRows={2} label="Texto" sx={{ mb: 1 }} value={p.texto || ''} onChange={(e) => setProp(i, 'texto', e.target.value)} />
              : varSelect(i, 'var', 'Variable')}
            <TextField select size="small" fullWidth label="Alineación" value={p.align || 'left'}
              onChange={(e) => setProp(i, 'align', e.target.value)}>
              <MenuItem value="left">Izquierda</MenuItem>
              <MenuItem value="center">Centro</MenuItem>
              <MenuItem value="right">Derecha</MenuItem>
              <MenuItem value="justify">Justificado</MenuItem>
            </TextField>
          </>
        )
      }
      case 'qr_pie':
        return (
          <TextField size="small" fullWidth label="Texto del pie"
            value={p.texto || ''} onChange={(e) => setProp(i, 'texto', e.target.value)} />
        )
      default:
        return <Typography variant="caption" color="text.secondary">Este bloque se configura en la sección «Estilo».</Typography>
    }
  }

  return (
    <Box>
      {/* ---- Estilo global ---- */}
      <Typography variant="subtitle2" gutterBottom>Estilo del documento</Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center" sx={{ mb: 1 }}>
        <TextField select size="small" label="Tamaño de fuente" sx={{ minWidth: 140 }}
          value={estilo.fuente_tamano || '12pt'} onChange={(e) => setEstilo({ fuente_tamano: e.target.value })}>
          {TAMANOS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Color institucional</Typography>
          <input type="color" value={estilo.membrete?.color || '#0071BC'}
            onChange={(e) => setEstilo({ membrete: { ...estilo.membrete, color: e.target.value } })}
            style={{ width: 48, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <FormControlLabel control={<Checkbox size="small" checked={estilo.logo?.mostrar !== false}
          onChange={(e) => setEstilo({ logo: { ...estilo.logo, mostrar: e.target.checked } })} />} label="Mostrar logo" />
        <FormControlLabel control={<Checkbox size="small" checked={estilo.barra_colores?.mostrar !== false}
          onChange={(e) => setEstilo({ barra_colores: { ...estilo.barra_colores, mostrar: e.target.checked } })} />} label="Barra de colores" />
        <FormControlLabel control={<Checkbox size="small" checked={estilo.regla_azul !== false}
          onChange={(e) => setEstilo({ regla_azul: e.target.checked })} />} label="Regla azul" />
      </Stack>

      <Divider sx={{ my: 1 }} />

      {/* ---- Estructura por bloques ---- */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2">Bloques del documento</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={(e) => setAddAnchor(e.currentTarget)}>Agregar bloque</Button>
        <Menu anchorEl={addAnchor} open={!!addAnchor} onClose={() => setAddAnchor(null)}>
          {CATALOGO.map((c) => <MenuItem key={c.tipo} onClick={() => addBloque(c.tipo)}>{c.label}</MenuItem>)}
        </Menu>
      </Box>

      <Stack spacing={1}>
        {estructura.map((b, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>
                {i + 1}. {labelDe(b.tipo)}
              </Typography>
              <Tooltip title="Editar propiedades">
                <span>
                  <IconButton size="small" disabled={['barra_colores', 'membrete'].includes(b.tipo)}
                    color={expanded === i ? 'primary' : 'default'}
                    onClick={() => setExpanded(expanded === i ? null : i)}>
                    <PropsIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0}><UpIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => move(i, 1)} disabled={i === estructura.length - 1}><DownIcon fontSize="small" /></IconButton>
              <IconButton size="small" color="error" onClick={() => remove(i)}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
            <Collapse in={expanded === i} unmountOnExit>
              <Box sx={{ pt: 1.5 }}>{renderProps(b, i)}</Box>
            </Collapse>
          </Paper>
        ))}
        {estructura.length === 0 && (
          <Typography variant="caption" color="text.secondary">Sin bloques. Agrega el primero con «Agregar bloque».</Typography>
        )}
      </Stack>
    </Box>
  )
}

export default BloquesEditor
