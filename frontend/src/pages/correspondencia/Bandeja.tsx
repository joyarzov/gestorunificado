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
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Pagination,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  CheckCircle as RecibirIcon,
  Archive as ArchivarIcon,
} from '@mui/icons-material'
import { correspondenciaAPI } from '../../api/correspondencia'
import { Derivacion } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'

const BandejaEntrada = () => {
  const navigate = useNavigate()
  const { user, actuandoComo } = useAuth()
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [counts, setCounts] = useState({ pendientes: 0, recibidas: 0 })

  useEffect(() => {
    loadBandeja()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actuandoComo?.id, tab, page])

  const loadBandeja = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await correspondenciaAPI.derivacionesPendientes({
        tab: tab === 0 ? 'pendientes' : 'recibidas',
        page,
        per_page: 30,
      })
      setDerivaciones(response.data.items)
      setLastPage(response.data.last_page)
      setCounts(response.data.counts)
    } catch (err) {
      setError('Error al cargar la bandeja de entrada')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRecibir = async (id: number) => {
    try {
      await correspondenciaAPI.recibirDerivacion(id)
      loadBandeja()
    } catch (err) {
      console.error('Error al recibir:', err)
    }
  }

  const handleArchivar = async (id: number) => {
    try {
      await correspondenciaAPI.archivarDerivacion(id)
      loadBandeja()
    } catch (err) {
      console.error('Error al archivar:', err)
    }
  }

  // El filtrado por pestaña y la paginación (30 por página) los hace el backend.
  const filteredDerivaciones = derivaciones

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Bandeja de Entrada
        </Typography>
        <Button variant="contained" onClick={loadBandeja}>
          Actualizar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <Tabs
          value={tab}
          onChange={(_, newValue) => { setTab(newValue); setPage(1) }}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {/* "Activas" agrupa lo por recibir Y lo derivado en seguimiento;
              el estado puntual de cada ítem lo dice su chip. */}
          <Tab label={`Activas (${counts.pendientes})`} />
          <Tab label={`Recibidas (${counts.recibidas})`} />
        </Tabs>

        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Folio</TableCell>
                <TableCell>N° Documento</TableCell>
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
              ) : filteredDerivaciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay correspondencia en esta bandeja
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDerivaciones.map((der) => (
                  <TableRow key={der.id} hover>
                    <TableCell><strong>{der.correspondencia?.folio || `#${der.correspondencia_id}`}</strong></TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {der.correspondencia?.numero_documento || '-'}
                      </Typography>
                      {der.usuario_destino_id
                        && der.usuario_destino_id !== user?.id
                        && der.usuario_destino_id !== actuandoComo?.id && (
                        <Chip
                          label={`Para: ${der.usuario_destino?.nombre ?? 'subrogado'}`}
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{der.correspondencia?.remitente || '-'}</TableCell>
                    <TableCell>
                      {der.correspondencia?.fecha_recibo
                        ? format(new Date(der.correspondencia.fecha_recibo), 'dd/MM/yyyy', { locale: es })
                        : format(new Date(der.created_at), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>{der.departamento_origen?.nombre || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={der.estado === 'pendiente' ? 'Por recibir' : der.estado === 'recibido' ? 'Recibida' : der.estado === 'derivado' ? 'Derivada a Funcionario' : der.estado}
                        color={der.estado === 'pendiente' ? 'warning' : der.estado === 'derivado' ? 'info' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/correspondencia/${der.correspondencia_id}`)}
                        title="Ver detalle"
                      >
                        <ViewIcon />
                      </IconButton>
                      {der.estado === 'pendiente' && der.puede_actuar && (
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleRecibir(der.id)}
                          title="Marcar como recibido"
                        >
                          <RecibirIcon />
                        </IconButton>
                      )}
                      {der.estado === 'recibido' && der.puede_actuar && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleArchivar(der.id)}
                          title="Archivar"
                        >
                          <ArchivarIcon />
                        </IconButton>
                      )}
                      {!der.puede_actuar && (der.estado === 'pendiente' || der.estado === 'recibido') && (
                        <Chip label="Solo lectura" size="small" variant="outlined" sx={{ ml: 0.5, height: 20, fontSize: 10 }} />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {lastPage > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5, borderTop: '1px solid #eee' }}>
            <Pagination
              count={lastPage}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              size="small"
            />
          </Box>
        )}
      </Card>
    </Box>
  )
}

export default BandejaEntrada
