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
  CircularProgress,
  Alert,
} from '@mui/material'
import { Visibility as ViewIcon } from '@mui/icons-material'
import { oirsFuncionarioAPI } from '../../api/oirs'
import { OirsSolicitud } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const estadoColors: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  asignada: 'info',
  pendiente: 'warning',
  en_analisis: 'info',
  respondido: 'success',
}

const OirsFuncionarioList = () => {
  const navigate = useNavigate()
  const [solicitudes, setSolicitudes] = useState<OirsSolicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadMisSolicitudes()
  }, [])

  const loadMisSolicitudes = async () => {
    setLoading(true)
    try {
      const response = await oirsFuncionarioAPI.misAsignadas()
      setSolicitudes(response.data.data)
    } catch (err) {
      setError('Error al cargar las solicitudes')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Mis Solicitudes Asignadas
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell>Folio</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Asunto</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Prioridad</TableCell>
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
              ) : solicitudes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No tienes solicitudes asignadas
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                solicitudes.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.folio}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      {item.tipo_solicitud.replace('_', ' ')}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 250,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.asunto}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.prioridad}
                        color={item.prioridad === 'alta' ? 'error' : item.prioridad === 'media' ? 'warning' : 'info'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.estado}
                        color={estadoColors[item.estado] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/mis-solicitudes/${item.id}`)}
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
    </Box>
  )
}

export default OirsFuncionarioList
