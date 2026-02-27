import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { fondosConcursablesAPI } from '../../api/fondos'
import { Postulacion, FondoConcursable } from '../../types'

const estadoConfig: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }> = {
  borrador: { label: 'Borrador', color: 'default' },
  enviada: { label: 'Enviada', color: 'info' },
  en_revision: { label: 'En Revisión', color: 'warning' },
  aprobada: { label: 'Aprobada', color: 'success' },
  rechazada: { label: 'Rechazada', color: 'error' },
}

const PostulacionesList = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const fondoId = parseInt(id || '0')

  const [fondo, setFondo] = useState<FondoConcursable | null>(null)
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const cargarPostulaciones = useCallback(async () => {
    setLoading(true)
    try {
      const [fondoRes, postRes] = await Promise.all([
        fondosConcursablesAPI.obtener(fondoId),
        fondosConcursablesAPI.postulaciones(fondoId, {
          page: page + 1,
          per_page: 20,
          estado: filtroEstado || undefined,
          search: search || undefined,
        }),
      ])
      setFondo(fondoRes.data)
      const paginatedData = postRes.data as unknown as { data: Postulacion[]; total: number }
      setPostulaciones(paginatedData.data)
      setTotal(paginatedData.total)
    } catch {
      setError('Error al cargar postulaciones')
    } finally {
      setLoading(false)
    }
  }, [fondoId, page, filtroEstado, search])

  useEffect(() => {
    cargarPostulaciones()
  }, [cargarPostulaciones])

  const handleSearch = () => {
    setPage(0)
    cargarPostulaciones()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/fomento-productivo')}>
          Volver
        </Button>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            {fondo?.nombre || 'Postulaciones'}
          </Typography>
          {fondo && (
            <Typography variant="body2" color="text.secondary">
              {fondo.codigo} - {fondo.anio}
            </Typography>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Buscar por nombre, RUT o código"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            sx={{ minWidth: 280 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={filtroEstado}
              label="Estado"
              onChange={(e) => { setFiltroEstado(e.target.value); setPage(0) }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="enviada">Enviada</MenuItem>
              <MenuItem value="en_revision">En Revisión</MenuItem>
              <MenuItem value="aprobada">Aprobada</MenuItem>
              <MenuItem value="rechazada">Rechazada</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<SearchIcon />} onClick={handleSearch}>
            Buscar
          </Button>
        </Box>
      </Paper>

      {/* Tabla */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell>Código</TableCell>
                <TableCell>Postulante</TableCell>
                <TableCell>RUT</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Puntaje</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {postulaciones.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>
                      {p.codigo}
                    </Typography>
                  </TableCell>
                  <TableCell>{p.nombre_postulante}</TableCell>
                  <TableCell>{p.rut_postulante}</TableCell>
                  <TableCell>
                    <Chip
                      label={estadoConfig[p.estado]?.label || p.estado}
                      color={estadoConfig[p.estado]?.color || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {p.puntaje != null ? `${p.puntaje}%` : '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(p.created_at).toLocaleDateString('es-CL')}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Ver detalle">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => navigate(`/postulaciones/${p.id}`)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {postulaciones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      No hay postulaciones
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={20}
            rowsPerPageOptions={[20]}
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          />
        </TableContainer>
      )}
    </Box>
  )
}

export default PostulacionesList
