import { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material'
import { Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material'
import { reservasAPI } from '../../api/reservas'
import { Reserva } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ReservasSolicitudes = () => {
  const [solicitudes, setSolicitudes] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accionId, setAccionId] = useState<number | null>(null)
  const [rechazar, setRechazar] = useState<Reserva | null>(null)
  const [motivo, setMotivo] = useState('')

  const cargar = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await reservasAPI.reservasPendientes()
      setSolicitudes(res.data)
    } catch {
      setError('No se pudieron cargar las solicitudes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const handleAprobar = async (r: Reserva) => {
    setAccionId(r.id)
    try {
      await reservasAPI.reservaAprobar(r.id)
      await cargar()
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo aprobar.')
    } finally {
      setAccionId(null)
    }
  }

  const handleRechazar = async () => {
    if (!rechazar) return
    setAccionId(rechazar.id)
    try {
      await reservasAPI.reservaRechazar(rechazar.id, motivo.trim() || undefined)
      setRechazar(null)
      setMotivo('')
      await cargar()
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo rechazar.')
    } finally {
      setAccionId(null)
    }
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>Solicitudes de reserva</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : solicitudes.length === 0 ? (
        <Alert severity="success">No tienes solicitudes pendientes de aprobación.</Alert>
      ) : (
        <Stack spacing={2}>
          {solicitudes.map((r) => (
            <Card key={r.id}>
              <CardContent>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2 }}>
                  <Box>
                    <Typography variant="h6">{r.titulo}</Typography>
                    <Chip label={r.espacio?.nombre || 'Espacio'} size="small" sx={{ mb: 1 }} />
                    <Typography variant="body2">
                      <strong>Cuándo:</strong>{' '}
                      {format(new Date(r.inicio), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                      {' a '}{format(new Date(r.fin), 'HH:mm', { locale: es })}
                    </Typography>
                    <Typography variant="body2"><strong>Solicitó:</strong> {r.solicitante?.nombre || '—'}</Typography>
                    {r.descripcion && <Typography variant="body2"><strong>Descripción:</strong> {r.descripcion}</Typography>}
                    {r.asistentes && r.asistentes.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                        {r.asistentes.map((a) => <Chip key={a.id} label={a.nombre} size="small" variant="outlined" />)}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<CheckIcon />}
                      disabled={accionId === r.id}
                      onClick={() => handleAprobar(r)}
                    >
                      Aprobar
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<CloseIcon />}
                      disabled={accionId === r.id}
                      onClick={() => { setRechazar(r); setMotivo('') }}
                    >
                      Rechazar
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={!!rechazar} onClose={() => setRechazar(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Rechazar solicitud</DialogTitle>
        <Divider />
        <DialogContent>
          <TextField
            label="Motivo (opcional)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            multiline
            rows={3}
            fullWidth
            sx={{ mt: 1 }}
            helperText="Se incluye en el aviso al solicitante."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRechazar(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleRechazar} disabled={accionId === rechazar?.id}>
            Rechazar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ReservasSolicitudes
