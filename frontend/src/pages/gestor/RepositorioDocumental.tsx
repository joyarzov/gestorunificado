import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  Description as DocIcon,
  CalendarMonth as CalendarIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material'
import { documentosAPI, tiposDocumentalesAPI } from '../../api/gestor'
import { Documento, TipoDocumental } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const RepositorioDocumental = () => {
  const navigate = useNavigate()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [tiposDocumentales, setTiposDocumentales] = useState<TipoDocumental[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [total, setTotal] = useState(0)

  // Estadísticas
  const [estadisticas, setEstadisticas] = useState<{
    total: number
    por_estado: Record<string, number>
    por_tipo: Record<string, number>
    creados_este_mes: number
  } | null>(null)

  // Filtros
  const [search, setSearch] = useState('')
  const [tipoDocumentalId, setTipoDocumentalId] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    tiposDocumentalesAPI.listar().then((res) => {
      if (res.success) setTiposDocumentales(res.data)
    }).catch(() => {})

    documentosAPI.estadisticas().then((res) => {
      if (res.success) setEstadisticas(res.data)
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
        estado: 'firmado',
        search: search || undefined,
        tipo_documental_id: tipoDocumentalId ? Number(tipoDocumentalId) : undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      })
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
    setTipoDocumentalId('')
    setFechaDesde('')
    setFechaHasta('')
    setPage(0)
    setTimeout(() => loadDocumentos(), 0)
  }

  const handleDescargar = async (id: number, numero?: string | null) => {
    try {
      const blob = await documentosAPI.descargar(id)
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${numero || `documento-${id}`}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error descargando documento:', error)
    }
  }

  const hayFiltrosActivos = search || tipoDocumentalId || fechaDesde || fechaHasta

  const totalFirmados = estadisticas?.por_estado?.firmado || 0
  const firmadosEsteMes = estadisticas?.creados_este_mes || 0

  return (
    <Box>
      {/* Cabecera */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Repositorio Documental
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Archivo de documentos firmados de la municipalidad
        </Typography>
      </Box>

      {/* Tarjetas de resumen */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#9f7aea20', color: '#9f7aea' }}>
                <ArchiveIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold">{totalFirmados}</Typography>
                <Typography variant="body2" color="text.secondary">Total firmados</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#4299e120', color: '#4299e1' }}>
                <DocIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  {estadisticas ? Object.keys(estadisticas.por_tipo).length : 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">Tipos documentales</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#48bb7820', color: '#48bb78' }}>
                <CalendarIcon fontSize="large" />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold">{firmadosEsteMes}</Typography>
                <Typography variant="body2" color="text.secondary">Creados este mes</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Panel de filtros */}
      <Card sx={{ mb: 3, p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <FilterIcon color="action" fontSize="small" />
          <Typography variant="subtitle2" color="text.secondary">
            Filtros de búsqueda
          </Typography>
        </Box>

        <Grid container spacing={2} alignItems="flex-end">
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

          <Grid item xs={6} sm={3} md={2}>
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

          <Grid item xs={6} sm={3} md={2}>
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

      {/* Tabla de documentos */}
      <Card>
        <TableContainer>
          <Table sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell>Número</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Título</TableCell>
                <TableCell>Fecha de creación</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : documentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {hayFiltrosActivos ? 'No se encontraron documentos con los filtros aplicados' : 'No hay documentos firmados'}
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
                    <TableCell>{item.tipo_documental?.nombre || '-'}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.titulo}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: es })}
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
                      <Tooltip title="Descargar PDF">
                        <IconButton
                          size="small"
                          onClick={() => handleDescargar(item.id, item.numero)}
                        >
                          <DownloadIcon />
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

export default RepositorioDocumental
