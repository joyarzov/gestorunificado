import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
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

const nivelAccesoLabels: Record<number, string> = {
  1: 'Público',
  2: 'Restringido',
  3: 'Reservado',
  4: 'Secreto',
}

const ExpedientesList = () => {
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
      const response = await expedientesAPI.misExpedientes({
        page: page + 1,
        per_page: rowsPerPage,
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
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Mis Expedientes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/expedientes/nuevo')}
        >
          Nuevo Expediente
        </Button>
      </Box>

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
        <TableContainer>
          <Table sx={{ minWidth: 750 }}>
            <TableHead>
              <TableRow>
                <TableCell>Identificador</TableCell>
                <TableCell>Título</TableCell>
                <TableCell>Asunto</TableCell>
                <TableCell>Nivel Acceso</TableCell>
                <TableCell>Fecha Creación</TableCell>
                <TableCell>Estado</TableCell>
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
                      No hay expedientes registrados
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                expedientes.map((item: any) => (
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
                      <Chip
                        label={nivelAccesoLabels[item.nivel_acceso] || 'Público'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
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
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/expedientes/${item.id}`)}
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

export default ExpedientesList
