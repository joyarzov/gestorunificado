import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Stack,
  Tab,
  Tabs,
  Badge,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material'
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  MoveToInbox as RecibirIcon,
} from '@mui/icons-material'
import { expedientesAPI, VistaExpedientes } from '../../api/gestor'
import { Expediente } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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

/**
 * Tabs de la pantalla. "Por recibir" y "En mi poder" son excluyentes: un expediente
 * derivado no aparece como propio hasta que el funcionario acusa recibo. "Creados por
 * mí" es otro eje (lo que yo abrí, esté donde esté), por eso puede repetir filas.
 */
const VISTAS: Array<{ value: VistaExpedientes; label: string; vacio: string }> = [
  { value: 'por_recibir', label: 'Por recibir', vacio: 'No tienes expedientes por recibir' },
  { value: 'en_poder', label: 'En mi poder', vacio: 'No tienes expedientes a tu cargo' },
  { value: 'creados', label: 'Creados por mí', vacio: 'Aún no has creado expedientes' },
  { value: 'cerrados', label: 'Cerrados', vacio: 'No hay expedientes cerrados' },
]

const esVistaValida = (v: string | null): v is VistaExpedientes =>
  VISTAS.some((x) => x.value === v)

/** Quién tiene el expediente: uno, varios (multi-destino) o nadie todavía. */
const enPoderDe = (exp: Expediente): string => {
  if (exp.responsable_actual?.nombre) return exp.responsable_actual.nombre
  const destinos = (exp.derivaciones_activas || [])
    .map((d) => d.usuario_destino?.nombre || d.departamento_destino?.nombre)
    .filter((n): n is string => !!n)
  const unicos = [...new Set(destinos)]
  if (unicos.length > 0) return unicos.join(', ')
  return exp.creador?.nombre || '-'
}

const ExpedientesList = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const vistaUrl = searchParams.get('tab')
  const [vista, setVista] = useState<VistaExpedientes>(
    esVistaValida(vistaUrl) ? vistaUrl : 'en_poder',
  )
  const [expedientes, setExpedientes] = useState<Expediente[]>([])
  const [conteos, setConteos] = useState<Partial<Record<VistaExpedientes, number>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [recibiendoId, setRecibiendoId] = useState<number | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  // Columnas de derivación solo donde aportan: en los tabs donde el expediente llegó de otro.
  const muestraOrigen = vista === 'por_recibir' || vista === 'en_poder'
  const columnas = muestraOrigen ? 7 : 6

  const cargarConteos = useCallback(async () => {
    try {
      const res = await expedientesAPI.resumenVistas()
      setConteos(res.data || {})
    } catch (err) {
      console.error('Error cargando contadores de expedientes:', err)
    }
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await expedientesAPI.misExpedientes({
        vista,
        page: page + 1,
        per_page: rowsPerPage,
        search,
      })
      setExpedientes(res.data.data)
      setTotal(res.data.total)
    } catch (err) {
      setError('Error al cargar los expedientes')
      console.error(err)
    } finally {
      setLoading(false)
    }
    // `search` se dispara a mano desde el botón/Enter, no en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, page, rowsPerPage])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    cargarConteos()
  }, [cargarConteos])

  const handleVista = (nueva: VistaExpedientes) => {
    setVista(nueva)
    setPage(0)
    setSearchParams({ tab: nueva }, { replace: true })
  }

  const handleSearch = () => {
    setPage(0)
    cargar()
  }

  const handleRecibir = async (id: number) => {
    setRecibiendoId(id)
    try {
      await expedientesAPI.recibir(id)
      setSnackbar({ open: true, message: 'Expediente recibido, ahora está en tu poder', severity: 'success' })
      cargar()
      cargarConteos()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al recibir el expediente'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setRecibiendoId(null)
    }
  }

  const vistaActual = VISTAS.find((v) => v.value === vista)!

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 1 }}>
        <Typography variant="h4" fontWeight="bold">
          Expedientes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/expedientes/nuevo')}
        >
          Nuevo Expediente
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Los expedientes que te derivaron y los que tienes a tu cargo, en un solo lugar.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3, p: 2 }}>
        <TextField
          fullWidth
          placeholder="Buscar por identificador, título, asunto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <Button onClick={handleSearch}>Buscar</Button>
            ),
          }}
        />
      </Card>

      <Card>
        <Tabs
          value={vista}
          onChange={(_, v) => handleVista(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {VISTAS.map((v) => (
            <Tab
              key={v.value}
              value={v.value}
              label={
                <Badge
                  color={v.value === 'por_recibir' ? 'error' : 'primary'}
                  badgeContent={conteos[v.value] || 0}
                  sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none', ml: 1 } }}
                >
                  {v.label}
                </Badge>
              }
            />
          ))}
        </Tabs>
        <TableContainer>
          <Table sx={{ minWidth: 750 }}>
            <TableHead>
              <TableRow>
                <TableCell>Identificador</TableCell>
                <TableCell>Título</TableCell>
                {muestraOrigen && <TableCell>Enviado por</TableCell>}
                {muestraOrigen && <TableCell>Acciones solicitadas</TableCell>}
                {!muestraOrigen && <TableCell>Asunto</TableCell>}
                {!muestraOrigen && <TableCell>En poder de</TableCell>}
                <TableCell>Fecha</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columnas} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : expedientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnas} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">{vistaActual.vacio}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                expedientes.map((item) => {
                  const deriv = item.ultima_derivacion
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.identificador}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {item.titulo}
                        </Typography>
                        {muestraOrigen && deriv?.observaciones && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {deriv.observaciones}
                          </Typography>
                        )}
                      </TableCell>

                      {muestraOrigen && (
                        <TableCell>{deriv?.usuario_origen?.nombre || '-'}</TableCell>
                      )}
                      {muestraOrigen && (
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {(deriv?.acciones_para || []).map((a) => (
                              <Chip key={a} label={a} size="small" variant="outlined" />
                            ))}
                            {(!deriv?.acciones_para || deriv.acciones_para.length === 0) && '-'}
                          </Stack>
                        </TableCell>
                      )}

                      {!muestraOrigen && (
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {item.asunto || '-'}
                          </Typography>
                        </TableCell>
                      )}
                      {/* Con varios destinos no hay responsable único; sin derivar
                          todavía, el responsable es nulo y lo tiene quien lo creó. */}
                      {!muestraOrigen && (
                        <TableCell>{enPoderDe(item)}</TableCell>
                      )}

                      <TableCell>
                        {item.fecha_creacion
                          ? format(new Date(item.fecha_creacion), 'dd/MM/yyyy', { locale: es })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={estadoLabels[item.estado] || item.estado}
                          color={estadoColors[item.estado] || 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          {vista === 'por_recibir' && (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<RecibirIcon />}
                              onClick={() => handleRecibir(item.id)}
                              disabled={recibiendoId === item.id}
                            >
                              Recibir
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ViewIcon />}
                            onClick={() => navigate(`/expedientes/${item.id}`)}
                          >
                            Abrir
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10))
            setPage(0)
          }}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ExpedientesList
