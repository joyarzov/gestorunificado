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

const CorrespondenciaSearch = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Correspondencia[]>([])
  const [searched, setSearched] = useState(false)

  const [filters, setFilters] = useState({
    search: '',
    estado: '',
    fecha_desde: null as Date | null,
    fecha_hasta: null as Date | null,
  })

  const handleSearch = async () => {
    setLoading(true)
    setSearched(true)
    try {
      const params = {
        search: filters.search,
        estado: filters.estado || undefined,
        fecha_desde: filters.fecha_desde?.toISOString().split('T')[0],
        fecha_hasta: filters.fecha_hasta?.toISOString().split('T')[0],
      }
      const response = await correspondenciaAPI.search(filters.search, params)
      setResults(response.data.data)
    } catch (error) {
      console.error('Error en búsqueda:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
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
                placeholder="Remitente, número de documento..."
                value={filters.search}
                onChange={(e) => handleChange('search', e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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
                onClick={handleSearch}
                disabled={loading}
                sx={{ height: 56 }}
              >
                Buscar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {searched && (
        <Card>
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
                        No se encontraron resultados
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((item) => (
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
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/correspondencia/${item.id}`)}
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
        </Card>
      )}
    </Box>
  )
}

export default CorrespondenciaSearch
