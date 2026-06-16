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
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Chip,
  Stack,
  Snackbar,
} from '@mui/material'
import { Visibility as VerIcon, MoveToInbox as RecibirIcon } from '@mui/icons-material'
import { expedientesAPI } from '../../api/gestor'
import { Expediente } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const BandejaExpedientes = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'pendiente' | 'recibido'>('pendiente')
  const [expedientes, setExpedientes] = useState<Expediente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recibiendoId, setRecibiendoId] = useState<number | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await expedientesAPI.bandeja(tab)
      setExpedientes(res.data || [])
    } catch (err) {
      setError('Error al cargar la bandeja de expedientes')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  const handleRecibir = async (id: number) => {
    setRecibiendoId(id)
    try {
      await expedientesAPI.recibir(id)
      setSnackbar({ open: true, message: 'Expediente recibido', severity: 'success' })
      load()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al recibir el expediente'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setRecibiendoId(null)
    }
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Bandeja de Expedientes
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Expedientes que te derivaron para revisar, tramitar o gestionar.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Por recibir" value="pendiente" />
          <Tab label="En mi poder" value="recibido" />
        </Tabs>
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Expediente</TableCell>
                <TableCell>Título</TableCell>
                <TableCell>Enviado por</TableCell>
                <TableCell>Acciones solicitadas</TableCell>
                <TableCell>Fecha</TableCell>
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
              ) : expedientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {tab === 'pendiente'
                        ? 'No tienes expedientes por recibir'
                        : 'No tienes expedientes en tu poder'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                expedientes.map((exp) => {
                  const deriv = exp.ultima_derivacion
                  return (
                    <TableRow key={exp.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {exp.identificador}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {exp.titulo}
                        </Typography>
                        {deriv?.observaciones && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {deriv.observaciones}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{deriv?.usuario_origen?.nombre || '-'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          {(deriv?.acciones_para || []).map((a) => (
                            <Chip key={a} label={a} size="small" variant="outlined" />
                          ))}
                          {(!deriv?.acciones_para || deriv.acciones_para.length === 0) && '-'}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {deriv?.created_at
                          ? format(new Date(deriv.created_at), 'dd/MM/yyyy HH:mm', { locale: es })
                          : '-'}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          {tab === 'pendiente' && (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<RecibirIcon />}
                              onClick={() => handleRecibir(exp.id)}
                              disabled={recibiendoId === exp.id}
                            >
                              Recibir
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VerIcon />}
                            onClick={() => navigate(`/expedientes/${exp.id}`)}
                          >
                            Abrir
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default BandejaExpedientes
