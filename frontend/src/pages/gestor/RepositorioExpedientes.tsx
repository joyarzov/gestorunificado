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
} from '@mui/material'
import {
  Visibility as ViewIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { expedientesAPI } from '../../api/gestor'
import { Expediente } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const RepositorioExpedientes = () => {
  const navigate = useNavigate()
  const [expedientes, setExpedientes] = useState<Expediente[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadExpedientes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage])

  const loadExpedientes = async () => {
    setLoading(true)
    try {
      const response = await expedientesAPI.listar({
        page: page + 1,
        per_page: rowsPerPage,
        estado: 'cerrado',
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
          Expedientes cerrados de la municipalidad
        </Typography>
      </Box>

      <Card sx={{ mb: 3, p: 2 }}>
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
                <TableCell>Fecha Cierre</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : expedientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay expedientes cerrados
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
