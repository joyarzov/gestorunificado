import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  MenuItem,
  Grid,
  CircularProgress,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { oirsAPI } from '../../api/oirs'
import { OirsSolicitud } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoColors: Record<string, 'warning' | 'info' | 'success' | 'default' | 'error'> = {
  recibido: 'default',
  asignada: 'info',
  pendiente: 'warning',
  en_analisis: 'info',
  derivado: 'warning',
  respondido: 'success',
  cerrado: 'success',
}

const prioridadColors: Record<string, 'warning' | 'info' | 'error'> = {
  baja: 'info',
  media: 'warning',
  alta: 'error',
}

type Modo = 'todas' | 'asignadas' | 'cerradas'

const OirsAdminList = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [solicitudes, setSolicitudes] = useState<OirsSolicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    search: '',
    estado: '',
    tipo_solicitud: '',
    prioridad: '',
  })

  const modo: Modo = useMemo(() => {
    if (location.pathname.startsWith('/oirs-admin/asignadas')) return 'asignadas'
    if (location.pathname.startsWith('/oirs-admin/cerradas')) return 'cerradas'
    return 'todas'
  }, [location.pathname])

  const titulo = modo === 'asignadas'
    ? 'Mis solicitudes asignadas'
    : modo === 'cerradas'
      ? 'Solicitudes cerradas'
      : 'Administración OIRS'

  // Al cambiar de modo, resetear página y filtros dependientes
  useEffect(() => {
    setPage(0)
    setFilters((f) => ({ ...f, estado: '' }))
  }, [modo])

  useEffect(() => {
    loadSolicitudes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, modo])

  const loadSolicitudes = async () => {
    setLoading(true)
    try {
      const params = {
        page: page + 1,
        per_page: rowsPerPage,
        ...filters,
        // Si estamos en "cerradas", forzar estado=cerrado sin importar el filtro
        ...(modo === 'cerradas' ? { estado: 'cerrado' } : {}),
      }
      const response = modo === 'asignadas'
        ? await oirsAPI.misAsignadas(params)
        : await oirsAPI.listar(params)
      setSolicitudes(response.data.data)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error cargando solicitudes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleSearch = () => {
    setPage(0)
    loadSolicitudes()
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {titulo}
      </Typography>

      {/* Filtros */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por folio, nombre..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              size="small"
              select
              label="Estado"
              value={modo === 'cerradas' ? 'cerrado' : filters.estado}
              onChange={(e) => handleFilterChange('estado', e.target.value)}
              disabled={modo === 'cerradas'}
              helperText={modo === 'cerradas' ? 'Fijo en esta vista' : ''}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="recibido">Recibido</MenuItem>
              <MenuItem value="asignada">Asignada</MenuItem>
              <MenuItem value="en_analisis">En Análisis</MenuItem>
              <MenuItem value="respondido">Respondido</MenuItem>
              <MenuItem value="cerrado">Cerrado</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              size="small"
              select
              label="Tipo"
              value={filters.tipo_solicitud}
              onChange={(e) => handleFilterChange('tipo_solicitud', e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="consulta">Consulta</MenuItem>
              <MenuItem value="reclamo">Reclamo</MenuItem>
              <MenuItem value="sugerencia">Sugerencia</MenuItem>
              <MenuItem value="felicitacion">Felicitación</MenuItem>
              <MenuItem value="solicitud_informacion">Solicitud Info</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              size="small"
              select
              label="Prioridad"
              value={filters.prioridad}
              onChange={(e) => handleFilterChange('prioridad', e.target.value)}
            >
              <MenuItem value="">Todas</MenuItem>
              <MenuItem value="baja">Baja</MenuItem>
              <MenuItem value="media">Media</MenuItem>
              <MenuItem value="alta">Alta</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <Box
              component="button"
              onClick={handleSearch}
              sx={{
                width: '100%',
                py: 1,
                px: 2,
                bgcolor: 'primary.main',
                color: 'white',
                border: 'none',
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              Filtrar
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Tabla */}
      <Card>
        <TableContainer>
          <Table sx={{ minWidth: 850 }}>
            <TableHead>
              <TableRow>
                <TableCell>Folio</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Solicitante</TableCell>
                <TableCell>Asunto</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Prioridad</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : solicitudes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay solicitudes
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                solicitudes.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.folio}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      {item.tipo_solicitud.replace('_', ' ')}
                    </TableCell>
                    <TableCell>
                      {item.anonimo ? (
                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                          Anónimo
                        </Typography>
                      ) : (
                        item.nombre_solicitante
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.asunto}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.prioridad}
                        color={prioridadColors[item.prioridad]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.estado}
                        color={estadoColors[item.estado]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/oirs-admin/${item.id}`)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
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
    </Box>
  )
}

export default OirsAdminList
