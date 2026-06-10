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
  FileDownload as DownloadIcon,
} from '@mui/icons-material'
import { correspondenciaAPI } from '../../api/correspondencia'
import { departamentosAPI } from '../../api/common'
import { Correspondencia, Departamento } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'

import { ESTADO_CORRESPONDENCIA, ESTADOS_ENTRADA, estadoCorrespondencia } from '../../utils/estadoCorrespondencia'

const CorrespondenciaList = () => {
  const navigate = useNavigate()
  const { isAdmin, isOficial } = useAuth()
  const [correspondencias, setCorrespondencias] = useState<Correspondencia[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [total, setTotal] = useState(0)

  // Filtros
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('')
  const [departamentoId, setDepartamentoId] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    departamentosAPI.listar().then((res) => {
      if (res.success) setDepartamentos(res.data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadCorrespondencias()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage])

  const loadCorrespondencias = async () => {
    setLoading(true)
    try {
      const response = await correspondenciaAPI.listar({
        page: page + 1,
        per_page: rowsPerPage,
        search: search || undefined,
        estado: estado || undefined,
        departamento_id: departamentoId ? Number(departamentoId) : undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      })
      setCorrespondencias(response.data.data)
      setTotal(response.data.total)
    } catch (error) {
      console.error('Error cargando correspondencias:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBuscar = () => {
    setPage(0)
    loadCorrespondencias()
  }

  const handleLimpiar = () => {
    setSearch('')
    setEstado('')
    setDepartamentoId('')
    setFechaDesde('')
    setFechaHasta('')
    setPage(0)
    setTimeout(() => loadCorrespondencias(), 0)
  }

  const hayFiltrosActivos = search || estado || departamentoId || fechaDesde || fechaHasta

  const [exportando, setExportando] = useState(false)
  const handleExportar = async () => {
    setExportando(true)
    try {
      const blob = await correspondenciaAPI.exportar({
        search: search || undefined,
        estado: estado || undefined,
        departamento_id: departamentoId ? Number(departamentoId) : undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `libro-correspondencia-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exportando:', error)
    } finally {
      setExportando(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Correspondencia
        </Typography>
        {(isAdmin() || isOficial()) && (
          <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={exportando ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={handleExportar}
            disabled={exportando}
          >
            Exportar
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/ingresar')}
          >
            Nueva Correspondencia
          </Button>
          </Box>
        )}
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
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Buscar"
              placeholder="Remitente, Nº documento, descripción..."
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

          {/* Departamento */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Departamento</InputLabel>
              <Select
                value={departamentoId}
                label="Departamento"
                onChange={(e) => setDepartamentoId(e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {departamentos.map((depto) => (
                  <MenuItem key={depto.id} value={depto.id}>
                    {depto.nombre}
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
                {ESTADOS_ENTRADA.map((key) => (
                  <MenuItem key={key} value={key}>{ESTADO_CORRESPONDENCIA[key].label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Fecha desde */}
          <Grid item xs={6} sm={6} md={2.5}>
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
          <Grid item xs={6} sm={6} md={2.5}>
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
                <TableCell>Folio</TableCell>
                <TableCell>Nº Documento</TableCell>
                <TableCell>Remitente</TableCell>
                <TableCell>Fecha Recibo</TableCell>
                <TableCell>Departamento</TableCell>
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
              ) : correspondencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {hayFiltrosActivos ? 'No se encontraron correspondencias con los filtros aplicados' : 'No hay correspondencias registradas'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                correspondencias.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell><strong>{item.folio || `#${item.id}`}</strong></TableCell>
                    <TableCell>{item.numero_documento || '-'}</TableCell>
                    <TableCell>{item.remitente}</TableCell>
                    <TableCell>
                      {format(new Date(item.fecha_recibo), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>{item.departamento?.nombre || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={estadoCorrespondencia(item.estado).label}
                        color={estadoCorrespondencia(item.estado).color}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Ver correspondencia">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/correspondencia/${item.id}`)}
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

export default CorrespondenciaList
