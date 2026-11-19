import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  Chip,
  Alert,
  CircularProgress,
  Typography,
} from '@mui/material'
import { usersAPI } from '../../api/common'
import { reservasAPI } from '../../api/reservas'
import { Espacio, Reserva, User } from '../../types'

interface ReservaDialogProps {
  open: boolean
  onClose: () => void
  espacio: Espacio
  /** Si viene, se edita esa reserva; si no, se crea una nueva. */
  reserva?: Reserva | null
  /** Prefill de inicio/fin (datetime-local) al crear desde el calendario. */
  prefillInicio?: string
  prefillFin?: string
  onSuccess: () => void
}

// Convierte una fecha a formato datetime-local (YYYY-MM-DDTHH:mm) en hora local.
const toLocalInput = (value?: string | Date): string => {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60000)
  return local.toISOString().slice(0, 16)
}

const ReservaDialog = ({ open, onClose, espacio, reserva, prefillInicio, prefillFin, onSuccess }: ReservaDialogProps) => {
  const esEdicion = !!reserva
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [asistentes, setAsistentes] = useState<User[]>([])
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setTitulo(reserva?.titulo ?? '')
    setDescripcion(reserva?.descripcion ?? '')
    setInicio(reserva ? toLocalInput(reserva.inicio) : (prefillInicio ?? ''))
    setFin(reserva ? toLocalInput(reserva.fin) : (prefillFin ?? ''))
    usersAPI.funcionarios()
      .then((res) => {
        setUsuarios(res.data)
        if (reserva?.asistentes) {
          const ids = reserva.asistentes.map((a) => a.id)
          setAsistentes(res.data.filter((u: User) => ids.includes(u.id)))
        } else {
          setAsistentes([])
        }
      })
      .catch(() => { /* sin lista, el resto funciona */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const valido = titulo.trim() && inicio && fin && fin > inicio

  const handleSubmit = async () => {
    if (!valido) {
      setError('Completa el motivo y un periodo válido (la hora de fin debe ser posterior al inicio).')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload = {
        espacio_id: espacio.id,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        inicio,
        fin,
        asistente_ids: asistentes.map((a) => a.id),
      }
      if (esEdicion && reserva) {
        await reservasAPI.reservaActualizar(reserva.id, payload)
      } else {
        await reservasAPI.reservaCrear(payload)
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo guardar la reserva.')
    } finally {
      setLoading(false)
    }
  }

  const titulo_dialog = esEdicion
    ? 'Editar reserva'
    : espacio.es_administrador
      ? `Nueva reserva · ${espacio.nombre}`
      : `Solicitar hora · ${espacio.nombre}`

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{titulo_dialog}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {!espacio.es_administrador && !esEdicion && (
            <Alert severity="info">
              Tu solicitud quedará <strong>pendiente de aprobación</strong> del administrador del espacio.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Motivo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Inicio"
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Fin"
              type="datetime-local"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
          <Autocomplete
            multiple
            options={usuarios}
            getOptionLabel={(opt) => `${opt.nombre}${opt.cargo ? ` (${opt.cargo})` : ''}`}
            value={asistentes}
            onChange={(_, value) => setAsistentes(value)}
            isOptionEqualToValue={(opt, value) => opt.id === value.id}
            renderTags={(value, getTagProps) =>
              value.map((opt, index) => (
                <Chip {...getTagProps({ index })} key={opt.id} label={opt.nombre} size="small" />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Asistentes"
                helperText="Recibirán un correo con la invitación de calendario (.ics)"
              />
            )}
          />
          <TextField
            label="Descripción del evento (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
          <Typography variant="caption" color="text.secondary">
            Espacio: {espacio.nombre}{espacio.ubicacion ? ` · ${espacio.ubicacion}` : ''}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !valido}>
          {loading ? <CircularProgress size={20} /> : (espacio.es_administrador || esEdicion ? 'Guardar' : 'Solicitar')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ReservaDialog
