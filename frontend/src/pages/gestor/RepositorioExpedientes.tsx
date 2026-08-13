import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Tooltip,
  Chip,
  MenuItem,
  Stack,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { expedientesAPI } from '../../api/gestor'
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

const RepositorioExpedientes = () => {
  const navigate = useNavigate()
  const [expedientes, setExpedientes] = useState<Expediente[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  // Vacío = todos los estados: el repositorio es la consulta de TODO el municipio.
  const [estado, setEstado] = useState('')

  useEffect(() => {
    loadExpedientes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, estado])

  const loadExpedientes = async () => {
    setLoading(true)
    try {
      const response = await expedientesAPI.repositorio({
        page: page + 1,
        per_page: rowsPerPage,
        estado: estado || undefined,
        search,
      })
      setExpedientes(response.data.data)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error cargando expedientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(0)
    loadExpedientes()
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Repositorio de Expedientes
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Todos los expedientes de la municipalidad, en cualquier estado. Solo lectura.
        </Typography>
      </Box>

      <Card sx={{ mb: 3, p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            fullWidth
            placeholder="Buscar por identificador, titulo, asunto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            label="Estado"
            value={estado}
            onChange={(e) => { setPage(0); setEstado(e.target.value) }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="borrador">Borrador</MenuItem>
            <MenuItem value="en_tramite">En Trámite</MenuItem>
            <MenuItem value="cerrado">Cerrado</MenuItem>
            <MenuItem value="archivado">Archivado</MenuItem>
          </TextField>
        </Stack>
      </Card>

      <Card>
        <TableContainer>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell>Identificador</TableCell>
                <TableCell>Titulo</TableCell>
                <TableCell>Asunto</TableCell>
                <TableCell>Creador</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Última actualización</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : expedientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay expedientes que coincidan
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                expedientes.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.identificador}
                      </Typography>
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
                        {item.titulo}
                      </Typography>
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
                        {item.asunto || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.creador?.nombre || '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={estadoLabels[item.estado] || item.estado}
                        color={estadoColors[item.estado] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {item.fecha_cierre
                        ? format(new Date(item.fecha_cierre), 'dd/MM/yyyy', { locale: es })
                        : item.updated_at
                          ? format(new Date(item.updated_at), 'dd/MM/yyyy', { locale: es })
                          : '-'}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Ver expediente">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/expedientes/${item.id}`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
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
          labelRowsPerPage="Filas por pagina:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </Card>
    </Box>
  )
}

export default RepositorioExpedientes
