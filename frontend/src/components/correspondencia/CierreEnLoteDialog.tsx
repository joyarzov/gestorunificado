import { useState, useEffect, useCallback } from 'react'
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, Link, Pagination, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography,
} from '@mui/material'
import {
  TaskAlt as CerrarIcon,
  OpenInNew as AbrirIcon,
  ChatBubbleOutline as ChatIcon,
} from '@mui/icons-material'
import { correspondenciaAPI, CorrespondenciaPorCerrar } from '../../api/correspondencia'

interface Props {
  open: boolean
  onClose: () => void
  /** Se llama tras cerrar, para que el panel se refresque. */
  onCerradas?: (cuantas: number) => void
}

/**
 * Puesta al día del rezago: cerrar de una vez los procesos que ya terminaron.
 *
 * Nace de un hecho medido: de 387 correspondencias de entrada solo 15 estaban
 * cerradas. No faltaba voluntad —el Alcalde sabe que le corresponde— sino
 * tiempo: cerrarlas de a una, entrando a cada ficha, no cabe en el día.
 *
 * Por eso la tabla trae lo justo para decidir sin abrir nada: quién acusó
 * recibo, cuánto se conversó y si ya salió una respuesta despachada.
 *
 * La respuesta es la señal más fuerte pero la más escasa —muchas entradas van
 * "para conocimiento" y no se responden nunca—, así que sola dejaba la tabla
 * en "Sin respuesta" de punta a punta y no ayudaba a decidir. El acuse
 * completo y la conversación son la evidencia de que el asunto se trabajó.
 *
 * Y cuando ninguna señal alcanza, el folio abre la ficha en otra pestaña: se
 * mira sin perder la selección ni cerrar esta ventana.
 */
/**
 * Estado del acuse de recibo en una línea.
 *
 * "Todos acusaron" es, para una entrada que va para conocimiento, el final
 * legítimo del trámite: no hay nada más que esperar. Por eso se muestra en
 * verde, al mismo nivel que una respuesta despachada.
 */
const acuses = (c: CorrespondenciaPorCerrar) => {
  if (c.destinatarios === 0) {
    return (
      <Tooltip title="No se derivó a ningún funcionario">
        <Typography variant="caption" color="text.secondary">Sin derivar</Typography>
      </Tooltip>
    )
  }
  const completo = c.con_acuse >= c.destinatarios
  return (
    <Tooltip title={completo
      ? 'Todos los destinatarios acusaron recibo'
      : `${c.con_acuse} de ${c.destinatarios} destinatarios acusaron recibo`}>
      <Chip
        size="small"
        variant="outlined"
        color={completo ? 'success' : c.con_acuse > 0 ? 'warning' : 'default'}
        label={completo ? `Todos (${c.destinatarios})` : `${c.con_acuse} de ${c.destinatarios}`}
      />
    </Tooltip>
  )
}

const CierreEnLoteDialog = ({ open, onClose, onCerradas }: Props) => {
  const [items, setItems] = useState<CorrespondenciaPorCerrar[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [cargando, setCargando] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [soloRespondidas, setSoloRespondidas] = useState(false)
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [resultado, setResultado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await correspondenciaAPI.porCerrar({
        page,
        per_page: 25,
        solo_respondidas: soloRespondidas || undefined,
      })
      if (res.success) {
        setItems(res.data.items)
        setTotal(res.data.total)
        setLastPage(res.data.last_page)
      }
    } catch {
      setError('No se pudo cargar la lista de procesos por cerrar.')
    } finally {
      setCargando(false)
    }
  }, [page, soloRespondidas])

  useEffect(() => {
    if (open) cargar()
  }, [open, cargar])

  // Cambiar de página o de filtro limpia la selección: cerrar algo que ya no
  // se está viendo sería cerrar a ciegas.
  useEffect(() => { setSeleccion(new Set()) }, [page, soloRespondidas])

  const alternar = (id: number) => {
    setSeleccion(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const todasDeLaPagina = items.length > 0 && items.every(i => seleccion.has(i.id))

  const alternarTodas = () => {
    setSeleccion(todasDeLaPagina ? new Set() : new Set(items.map(i => i.id)))
  }

  const cerrar = async () => {
    if (seleccion.size === 0) return
    setCerrando(true)
    setError(null)
    try {
      const res = await correspondenciaAPI.cerrarLote(Array.from(seleccion))
      if (res.success) {
        setResultado(res.message)
        setSeleccion(new Set())
        onCerradas?.(res.data.cerradas)
        cargar()
      }
    } catch {
      setError('No se pudieron cerrar los procesos. Inténtalo de nuevo.')
    } finally {
      setCerrando(false)
    }
  }

  return (
    <Dialog open={open} onClose={cerrando ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        Cerrar procesos terminados
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {total} correspondencias están en gestión esperando el cierre formal.
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={<Checkbox size="small" checked={soloRespondidas} onChange={(e) => { setPage(1); setSoloRespondidas(e.target.checked) }} />}
            label={<Typography variant="body2">Solo las que ya fueron respondidas</Typography>}
          />
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 260 }}>
            Si la respuesta salió, el proceso terminó. Pero muchas entradas van para
            conocimiento y no se responden nunca: ahí la señal es que todos acusaron
            recibo. Si ninguna alcanza, el folio abre la ficha en otra pestaña.
          </Typography>
        </Box>

        {resultado && <Alert severity="success" sx={{ mx: 2, mb: 1 }} onClose={() => setResultado(null)}>{resultado}</Alert>}
        {error && <Alert severity="error" sx={{ mx: 2, mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}

        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={todasDeLaPagina}
                    indeterminate={seleccion.size > 0 && !todasDeLaPagina}
                    onChange={alternarTodas}
                    title="Seleccionar todas las de esta página"
                  />
                </TableCell>
                <TableCell>Folio</TableCell>
                <TableCell>Remitente</TableCell>
                <TableCell>Sin movimiento</TableCell>
                <TableCell>Acuses</TableCell>
                <TableCell>Conversación</TableCell>
                <TableCell>Respuesta</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cargando ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No queda nada por cerrar con este filtro.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : items.map(c => (
                <TableRow key={c.id} hover selected={seleccion.has(c.id)} onClick={() => alternar(c.id)} sx={{ cursor: 'pointer' }}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={seleccion.has(c.id)} onChange={() => alternar(c.id)} />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Abrir la ficha en otra pestaña">
                      <Link
                        href={`/correspondencia/${c.id}`}
                        target="_blank"
                        rel="noopener"
                        underline="hover"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}
                      >
                        {c.folio || `#${c.id}`}
                        <AbrirIcon sx={{ fontSize: 14 }} />
                      </Link>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 240 }}>{c.remitente}</Typography>
                    {c.descripcion && (
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 240 }}>
                        {c.descripcion}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {c.dias_sin_movimiento === null ? '—' : `${c.dias_sin_movimiento} días`}
                    </Typography>
                  </TableCell>
                  <TableCell>{acuses(c)}</TableCell>
                  <TableCell>
                    {c.mensajes > 0 ? (
                      <Tooltip title={c.respondieron > 0
                        ? `${c.respondieron} de los destinatarios escribió en la conversación`
                        : 'Hubo conversación, pero ningún destinatario escribió'}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: c.respondieron > 0 ? 'success.main' : 'text.secondary' }}>
                          <ChatIcon sx={{ fontSize: 16 }} />
                          <Typography variant="body2">{c.mensajes}</Typography>
                        </Box>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Sin mensajes</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.respondida
                      ? <Chip size="small" color="success" label="Respondida" variant="outlined" />
                      : <Typography variant="caption" color="text.secondary">Sin respuesta</Typography>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {lastPage > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <Pagination count={lastPage} page={page} onChange={(_, v) => setPage(v)} size="small" color="primary" />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          El cierre queda registrado con tu nombre en cada correspondencia, y se puede reabrir.
        </Typography>
        <Button onClick={onClose} disabled={cerrando}>Cerrar ventana</Button>
        <Button
          variant="contained"
          startIcon={<CerrarIcon />}
          onClick={cerrar}
          disabled={seleccion.size === 0 || cerrando}
        >
          {cerrando ? 'Cerrando…' : `Cerrar ${seleccion.size} proceso${seleccion.size === 1 ? '' : 's'}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CierreEnLoteDialog
