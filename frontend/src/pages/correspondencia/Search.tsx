import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  MenuItem,
  Alert,
  Pagination,
} from '@mui/material'
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { correspondenciaAPI } from '../../api/correspondencia'
import { Correspondencia } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { ESTADO_CORRESPONDENCIA, ESTADOS_ENTRADA, estadoCorrespondencia } from '../../utils/estadoCorrespondencia'

const POR_PAGINA = 25

const CorrespondenciaSearch = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Correspondencia[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Lo último que se buscó de verdad, para que el "no hay resultados" nombre el
  // término consultado y no lo que se está tipeando recién.
  const [terminoBuscado, setTerminoBuscado] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)

  const [filters, setFilters] = useState({
    search: '',
    estado: '',
    fecha_desde: null as Date | null,
    fecha_hasta: null as Date | null,
  })

  // La fecha se manda como día local. Con toISOString() se convierte a UTC y en
  // Punta Arenas (UTC-3) el día retrocede: buscar "desde el 5" traía también
  // las del 4. Ver la memoria de zonas horarias del proyecto.
  const aDiaLocal = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd') : undefined)

  const buscar = async (pagina = 1) => {
    const termino = filters.search.trim()
    setLoading(true)
    setSearched(true)
    setError(null)
    setTerminoBuscado(termino)
    try {
      const response = await correspondenciaAPI.search(termino, {
        estado: filters.estado || undefined,
        fecha_desde: aDiaLocal(filters.fecha_desde),
        fecha_hasta: aDiaLocal(filters.fecha_hasta),
        page: pagina,
        per_page: POR_PAGINA,
      })
      setResults(response.data.data)
      setTotal(response.data.total)
      setLastPage(response.data.last_page)
      setPage(response.data.current_page)
    } catch (err) {
      console.error('Error en búsqueda:', err)
      setError('No se pudo completar la búsqueda. Inténtalo de nuevo.')
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // Cambiar cualquier filtro invalida la página en que se estaba: la siguiente
  // búsqueda parte de la primera.
  const handleChange = (field: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Búsqueda de Correspondencia
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Buscar"
                placeholder="Folio, remitente, N° de documento o materia"
                value={filters.search}
                onChange={(e) => handleChange('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscar(1)}
                helperText="Varias palabras achican el resultado: se buscan todas."
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                select
                label="Estado"
                value={filters.estado}
                onChange={(e) => handleChange('estado', e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {ESTADOS_ENTRADA.map((key) => (
                  <MenuItem key={key} value={key}>{ESTADO_CORRESPONDENCIA[key].label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <DatePicker
                label="Desde"
                value={filters.fecha_desde}
                onChange={(date) => handleChange('fecha_desde', date)}
                slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <DatePicker
                label="Hasta"
                value={filters.fecha_hasta}
                onChange={(date) => handleChange('fecha_hasta', date)}
                slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
                onClick={() => buscar(1)}
                disabled={loading}
                sx={{ height: 56 }}
              >
                Buscar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {searched && (
        <Card>
          {!loading && total > 0 && (
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">
                {total === 1 ? '1 resultado' : `${total} resultados`}
                {lastPage > 1 && ` · página ${page} de ${lastPage}`}
              </Typography>
            </Box>
          )}
          <TableContainer>
            <Table>
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
                ) : results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {terminoBuscado
                          ? <>No se encontraron resultados para <strong>«{terminoBuscado}»</strong></>
                          : 'No se encontraron resultados'}
                      </Typography>
                      {terminoBuscado && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          Se busca en folio, remitente, N° de documento y materia. Revisa los
                          filtros de estado y fecha, que también acotan.
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((item) => (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/correspondencia/${item.id}`)}
                    >
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
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); navigate(`/correspondencia/${item.id}`) }}
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

          {!loading && lastPage > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Pagination
                count={lastPage}
                page={page}
                onChange={(_, v) => buscar(v)}
                color="primary"
              />
            </Box>
          )}
        </Card>
      )}
    </Box>
  )
}

export default CorrespondenciaSearch
