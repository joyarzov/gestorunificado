import { useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es'
import type { EventClickArg, DateSelectArg, EventInput } from '@fullcalendar/core'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Divider,
} from '@mui/material'
import { Add as AddIcon, Event as EventIcon } from '@mui/icons-material'
import { reservasAPI } from '../../api/reservas'
import { Espacio, Reserva } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import ReservaDialog from '../../components/reservas/ReservaDialog'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADO_LABEL: Record<string, string> = {
  solicitada: 'Pendiente de aprobación',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}

const ReservasCalendario = () => {
  const { user } = useAuth()
  const calendarRef = useRef<FullCalendar | null>(null)
  const [espacios, setEspacios] = useState<Espacio[]>([])
  const [espacioId, setEspacioId] = useState<number | ''>('')
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const rango = useRef<{ desde: string; hasta: string } | null>(null)

  // Diálogo crear/solicitar
  const [dialogOpen, setDialogOpen] = useState(false)
  const [prefill, setPrefill] = useState<{ inicio?: string; fin?: string }>({})
  // Detalle de una reserva
  const [detalle, setDetalle] = useState<Reserva | null>(null)
  const [accionLoading, setAccionLoading] = useState(false)

  const espacioSel = espacios.find((e) => e.id === espacioId) || null

  useEffect(() => {
    reservasAPI.espaciosListar()
      .then((res) => {
        setEspacios(res.data.espacios)
        if (res.data.espacios.length > 0) setEspacioId(res.data.espacios[0].id)
      })
      .catch(() => setError('No se pudieron cargar los espacios.'))
  }, [])

  const cargarReservas = async () => {
    if (!espacioId || !rango.current) return
    setLoading(true)
    setError('')
    try {
      const res = await reservasAPI.reservasListar(espacioId, rango.current.desde, rango.current.hasta)
      setReservas(res.data)
    } catch {
      setError('No se pudieron cargar las reservas.')
    } finally {
      setLoading(false)
    }
  }

  // Recargar cuando cambia el espacio (si ya hay rango cargado).
  useEffect(() => {
    if (espacioId && rango.current) cargarReservas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espacioId])

  const eventos: EventInput[] = reservas.map((r) => {
    const aprobada = r.estado === 'aprobada'
    const color = espacioSel?.color || '#0071BC'
    return {
      id: String(r.id),
      title: r.titulo,
      start: r.inicio,
      end: r.fin,
      backgroundColor: aprobada ? color : '#ffffff',
      borderColor: color,
      textColor: aprobada ? '#ffffff' : color,
      extendedProps: { reserva: r },
    }
  })

  const handleSelect = (arg: DateSelectArg) => {
    if (!espacioSel) return
    setPrefill({
      inicio: toLocalInput(arg.start),
      fin: toLocalInput(arg.end),
    })
    setDialogOpen(true)
    calendarRef.current?.getApi().unselect()
  }

  const handleEventClick = (arg: EventClickArg) => {
    const r = arg.event.extendedProps.reserva as Reserva
    setDetalle(r)
  }

  const handleNueva = () => {
    setPrefill({})
    setDialogOpen(true)
  }

  const puedeCancelar = (r: Reserva) =>
    !!espacioSel?.es_administrador || r.solicitante_id === user?.id

  const handleCancelar = async (r: Reserva) => {
    setAccionLoading(true)
    try {
      await reservasAPI.reservaCancelar(r.id)
      setDetalle(null)
      cargarReservas()
    } catch { /* noop */ } finally {
      setAccionLoading(false)
    }
  }

  const handleAprobar = async (r: Reserva) => {
    setAccionLoading(true)
    try {
      await reservasAPI.reservaAprobar(r.id)
      setDetalle(null)
      cargarReservas()
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo aprobar.')
      setDetalle(null)
    } finally {
      setAccionLoading(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Reserva de Espacios</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Espacio</InputLabel>
            <Select
              label="Espacio"
              value={espacioId}
              onChange={(e) => setEspacioId(Number(e.target.value))}
            >
              {espacios.map((e) => (
                <MenuItem key={e.id} value={e.id}>{e.nombre}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleNueva} disabled={!espacioSel}>
            {espacioSel?.es_administrador ? 'Nueva reserva' : 'Solicitar hora'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {espacios.length === 0 && (
        <Alert severity="info">Aún no hay espacios configurados.</Alert>
      )}

      <Card>
        <CardContent>
          {loading && <Box sx={{ mb: 1 }}><CircularProgress size={18} /></Box>}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            locale={esLocale}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={eventos}
            selectable={!!espacioSel}
            selectMirror
            select={handleSelect}
            eventClick={handleEventClick}
            datesSet={(arg) => {
              rango.current = { desde: arg.startStr, hasta: arg.endStr }
              cargarReservas()
            }}
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            nowIndicator
            height="auto"
          />
        </CardContent>
      </Card>

      {/* Diálogo crear/solicitar */}
      {espacioSel && (
        <ReservaDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          espacio={espacioSel}
          prefillInicio={prefill.inicio}
          prefillFin={prefill.fin}
          onSuccess={cargarReservas}
        />
      )}

      {/* Detalle de reserva */}
      <Dialog open={!!detalle} onClose={() => setDetalle(null)} maxWidth="sm" fullWidth>
        {detalle && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventIcon /> {detalle.titulo}
            </DialogTitle>
            <DialogContent>
              <Stack spacing={1.2} sx={{ mt: 1 }}>
                <Chip
                  label={ESTADO_LABEL[detalle.estado] || detalle.estado}
                  color={detalle.estado === 'aprobada' ? 'success' : detalle.estado === 'solicitada' ? 'warning' : 'default'}
                  size="small"
                  sx={{ alignSelf: 'flex-start' }}
                />
                <Typography variant="body2">
                  <strong>Cuándo:</strong>{' '}
                  {format(new Date(detalle.inicio), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                  {' a '}
                  {format(new Date(detalle.fin), 'HH:mm', { locale: es })}
                </Typography>
                <Typography variant="body2">
                  <strong>Solicitó:</strong> {detalle.solicitante?.nombre || '—'}
                </Typography>
                {detalle.descripcion && (
                  <Typography variant="body2"><strong>Descripción:</strong> {detalle.descripcion}</Typography>
                )}
                {detalle.asistentes && detalle.asistentes.length > 0 && (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Asistentes:</strong></Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {detalle.asistentes.map((a) => (
                        <Chip key={a.id} label={a.nombre} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                )}
                {detalle.estado === 'rechazada' && detalle.motivo_rechazo && (
                  <Alert severity="warning">Rechazada: {detalle.motivo_rechazo}</Alert>
                )}
              </Stack>
            </DialogContent>
            <Divider />
            <DialogActions>
              {detalle.estado === 'solicitada' && espacioSel?.es_administrador && (
                <Button color="success" variant="contained" disabled={accionLoading} onClick={() => handleAprobar(detalle)}>
                  Aprobar
                </Button>
              )}
              {puedeCancelar(detalle) && (detalle.estado === 'solicitada' || detalle.estado === 'aprobada') && (
                <Button color="error" disabled={accionLoading} onClick={() => handleCancelar(detalle)}>
                  Cancelar reserva
                </Button>
              )}
              <Button onClick={() => setDetalle(null)}>Cerrar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}

// Convierte una fecha a datetime-local (YYYY-MM-DDTHH:mm) en hora local.
const toLocalInput = (d: Date): string => {
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export default ReservasCalendario
