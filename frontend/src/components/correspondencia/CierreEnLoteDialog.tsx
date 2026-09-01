import { useState, useEffect, useCallback } from 'react'
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, Pagination, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material'
import { TaskAlt as CerrarIcon } from '@mui/icons-material'
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
 * Por eso la tabla trae lo justo para decidir sin abrir nada, y destaca las
 * que ya tienen respuesta despachada: esas son, casi siempre, trabajo
 * terminado al que solo le falta la firma del cierre.
 */
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
    <Dialog open={open} onClose={cerrando ? undefined : onClose} maxWidth="md" fullWidth>
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
          <Typography variant="caption" color="text.secondary">
            Empezar por ahí es lo más seguro: si la respuesta salió, el proceso terminó.
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
                <TableCell>Respuesta</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cargando ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
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
                  <TableCell><strong>{c.folio || `#${c.id}`}</strong></TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 260 }}>{c.remitente}</Typography>
                    {c.descripcion && (
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 260 }}>
                        {c.descripcion}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {c.dias_sin_movimiento === null ? '—' : `${c.dias_sin_movimiento} días`}
                    </Typography>
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
