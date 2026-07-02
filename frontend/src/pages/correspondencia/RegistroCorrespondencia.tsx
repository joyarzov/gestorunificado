import { useState, useEffect, useCallback } from 'react'
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
  Button,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  MenuItem,
  Grid,
  InputAdornment,
} from '@mui/material'
import { Visibility as VerIcon, Search as SearchIcon, MenuBook as LibroIcon } from '@mui/icons-material'
import { correspondenciaAPI } from '../../api/correspondencia'
import { Correspondencia } from '../../types'
import ResumenGestion from '../../components/correspondencia/ResumenGestion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  derivada_alcaldia: 'Derivada a Alcaldía',
  en_proceso: 'En proceso',
  derivada_funcionario: 'Derivada a funcionario',
  completada: 'En gestión',
  archivado: 'Completada',
  reservada: 'Reservada',
  por_despachar: 'Por despachar',
  despachada: 'Despachada',
  devuelta: 'Devuelta',
  anulada: 'Anulada',
}
const estadoColor: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  pendiente: 'warning',
  derivada_alcaldia: 'info',
  en_proceso: 'info',
  derivada_funcionario: 'info',
  completada: 'info',
  archivado: 'success',
  reservada: 'warning',
  por_despachar: 'warning',
  despachada: 'success',
  devuelta: 'error',
  anulada: 'error',
}

const ESTADOS = Object.keys(estadoLabel)

const RegistroCorrespondencia = () => {
  const navigate = useNavigate()
  const [items, setItems] = useState<Correspondencia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(15)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('')
  const [direccion, setDireccion] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await correspondenciaAPI.registro({
        page: page + 1,
        per_page: rowsPerPage,
        search: search || undefined,
        estado: estado || undefined,
        direccion: direccion || undefined,
      })
      setItems(res.data.data)
      setTotal(res.data.total)
    } catch {
      setError('No se pudo cargar el registro de correspondencia')
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, search, estado, direccion])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LibroIcon color="primary" />
        <Typography variant="h4" fontWeight="bold">Registro de Correspondencia</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Consulta de solo lectura de todas las correspondencias del municipio (entradas y salidas, en curso y cerradas).
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={5}>
            <TextField
              fullWidth size="small" label="Buscar"
              placeholder="Folio, remitente, número o descripción"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={3}>
            <TextField select fullWidth size="small" label="Dirección" value={direccion}
              onChange={(e) => { setDireccion(e.target.value); setPage(0) }}>
              <MenuItem value="">Todas</MenuItem>
              <MenuItem value="entrada">Entrada</MenuItem>
              <MenuItem value="salida">Salida</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3} md={4}>
            <TextField select fullWidth size="small" label="Estado" value={estado}
              onChange={(e) => { setEstado(e.target.value); setPage(0) }}>
              <MenuItem value="">Todos</MenuItem>
              {ESTADOS.map((e) => <MenuItem key={e} value={e}>{estadoLabel[e]}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Card>

      <Card>
        <TableContainer>
          <Table sx={{ minWidth: 750 }}>
            <TableHead>
              <TableRow>
                <TableCell>Folio</TableCell>
                <TableCell>Dirección</TableCell>
                <TableCell>Remitente</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell>Departamento</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No se encontraron correspondencias</Typography>
                </TableCell></TableRow>
              ) : (
                items.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell><Typography variant="body2" fontWeight="medium">{c.folio || '-'}</Typography></TableCell>
                    <TableCell>
                      <Chip label={c.direccion === 'salida' ? 'Salida' : 'Entrada'} size="small" variant="outlined"
                        color={c.direccion === 'salida' ? 'secondary' : 'primary'} />
                    </TableCell>
                    <TableCell>{c.remitente}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.descripcion || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{c.departamento?.nombre || '-'}</TableCell>
                    <TableCell>{c.fecha_recibo ? format(new Date(c.fecha_recibo), 'dd/MM/yyyy', { locale: es }) : '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                        <Chip label={estadoLabel[c.estado] || c.estado} size="small" color={estadoColor[c.estado] || 'default'} />
                        <ResumenGestion correspondencia={c} variant="lista" />
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Button size="small" variant="outlined" startIcon={<VerIcon />}
                        onClick={() => navigate(`/correspondencia/${c.id}?soloLectura=1`)}>
                        Ver
                      </Button>
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
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
          rowsPerPageOptions={[15, 25, 50]}
          labelRowsPerPage="Filas por página"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </Card>
    </Box>
  )
}

export default RegistroCorrespondencia
