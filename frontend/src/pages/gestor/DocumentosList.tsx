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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
} from '@mui/icons-material'
import { documentosAPI, tiposDocumentalesAPI } from '../../api/gestor'
import { Documento, TipoDocumental } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoColors: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  borrador: 'default',
  pendiente_firma: 'warning',
  firmado: 'success',
  rechazado: 'error',
  anulado: 'error',
}

const estadoLabels: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_firma: 'Pendiente firma',
  firmado: 'Firmado',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
}

const DocumentosList = () => {
  const navigate = useNavigate()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [tiposDocumentales, setTiposDocumentales] = useState<TipoDocumental[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [total, setTotal] = useState(0)

  // Filtros
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('')
  const [tipoDocumentalId, setTipoDocumentalId] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    tiposDocumentalesAPI.listar().then((res) => {
      if (res.success) setTiposDocumentales(res.data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadDocumentos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage])

  const loadDocumentos = async () => {
    setLoading(true)
    try {
      const response = await documentosAPI.listar({
        page: page + 1,
        per_page: rowsPerPage,
        search: search || undefined,
        estado: estado || undefined,
        tipo_documental_id: tipoDocumentalId ? Number(tipoDocumentalId) : undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        creado_por: 'me',
      } as any)
      setDocumentos(response.data.data)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error cargando documentos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBuscar = () => {
    setPage(0)
    loadDocumentos()
  }

  const handleLimpiar = () => {
    setSearch('')
    setEstado('')
    setTipoDocumentalId('')
    setFechaDesde('')
    setFechaHasta('')
    setPage(0)
    // Cargar sin filtros
    setTimeout(() => loadDocumentos(), 0)
  }

  const hayFiltrosActivos = search || estado || tipoDocumentalId || fechaDesde || fechaHasta

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Mis Documentos
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/documentos/nuevo')}
        >
          Nuevo Documento
        </Button>
      </Box>

      {/* Panel de filtros */}
      <Card sx={{ mb: 3, p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <FilterIcon color="action" fontSize="small" />
          <Typography variant="subtitle2" color="text.secondary">
            Filtros de búsqueda
          </Typography>
        </Box>

        <Grid container spacing={2} alignItems="flex-end">
          {/* Buscador de texto */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Buscar"
              placeholder="Número, título, identificador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* Tipo documental */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo</InputLabel>
              <Select
                value={tipoDocumentalId}
                label="Tipo"
                onChange={(e) => setTipoDocumentalId(e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {tiposDocumentales.map((tipo) => (
                  <MenuItem key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Estado */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Estado</InputLabel>
              <Select
                value={estado}
                label="Estado"
                onChange={(e) => setEstado(e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {Object.entries(estadoLabels).map(([key, label]) => (
                  <MenuItem key={key} value={key}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Fecha desde */}
          <Grid item xs={6} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {/* Fecha hasta */}
          <Grid item xs={6} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>

        {/* Botones de acción */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button variant="contained" size="small" onClick={handleBuscar} startIcon={<SearchIcon />}>
            Buscar
          </Button>
          {hayFiltrosActivos && (
            <Button variant="outlined" size="small" onClick={handleLimpiar} startIcon={<ClearIcon />}>
              Limpiar filtros
            </Button>
          )}
        </Box>
      </Card>

      <Card>
        <TableContainer>
          <Table sx={{ minWidth: 750 }}>
            <TableHead>
              <TableRow>
                <TableCell>Número</TableCell>
                <TableCell>Título</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Expediente</TableCell>
                <TableCell>Fecha</TableCell>
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
              ) : documentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {hayFiltrosActivos ? 'No se encontraron documentos con los filtros aplicados' : 'No hay documentos registrados'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                documentos.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.numero || '-'}
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
                    <TableCell>{item.tipo_documental?.nombre || '-'}</TableCell>
                    <TableCell>
                      {item.expedientes && item.expedientes.length > 0
                        ? item.expedientes.map((e: any) => e.numero_expediente || e.identificador).join(', ')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={estadoLabels[item.estado] || item.estado.replace('_', ' ')}
                        color={estadoColors[item.estado] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Ver documento">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/documentos/${item.id}`)}
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
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </Card>
    </Box>
  )
}

export default DocumentosList
