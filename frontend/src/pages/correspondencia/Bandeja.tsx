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
} from '@mui/material'
import {
  Visibility as ViewIcon,
  CheckCircle as RecibirIcon,
  Archive as ArchivarIcon,
  Send as DerivarIcon,
} from '@mui/icons-material'
import { correspondenciaAPI } from '../../api/correspondencia'
import { Derivacion } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'

const BandejaEntrada = () => {
  const navigate = useNavigate()
  const { isAlcalde } = useAuth()
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)

  useEffect(() => {
    loadBandeja()
  }, [])

  const loadBandeja = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await correspondenciaAPI.derivacionesPendientes()
      setDerivaciones(response.data)
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

  const filteredDerivaciones = derivaciones.filter((d) => {
    if (tab === 0) return d.estado === 'pendiente'
    if (tab === 1) return d.estado === 'recibido'
    return true
  })

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
          onChange={(_, newValue) => setTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            label={`Pendientes (${derivaciones.filter((d) => d.estado === 'pendiente').length})`}
          />
          <Tab
            label={`Recibidos (${derivaciones.filter((d) => d.estado === 'recibido').length})`}
          />
        </Tabs>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Correspondencia</TableCell>
                <TableCell>Desde</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Estado</TableCell>
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
              ) : filteredDerivaciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay correspondencia en esta bandeja
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDerivaciones.map((der) => (
                  <TableRow key={der.id} hover>
                    <TableCell>{der.correspondencia_id}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {der.observaciones || 'Sin observaciones'}
                      </Typography>
                    </TableCell>
                    <TableCell>{der.departamento_origen?.nombre}</TableCell>
                    <TableCell>
                      {format(new Date(der.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={der.estado}
                        color={der.estado === 'pendiente' ? 'warning' : 'success'}
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
                      {der.estado === 'pendiente' && (
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleRecibir(der.id)}
                          title="Marcar como recibido"
                        >
                          <RecibirIcon />
                        </IconButton>
                      )}
                      {der.estado === 'recibido' && isAlcalde() && (
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => navigate(`/correspondencia/${der.correspondencia_id}`)}
                          title="Derivar a funcionario"
                        >
                          <DerivarIcon />
                        </IconButton>
                      )}
                      {der.estado === 'recibido' && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleArchivar(der.id)}
                          title="Archivar"
                        >
                          <ArchivarIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  )
}

export default BandejaEntrada
