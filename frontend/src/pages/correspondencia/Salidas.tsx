import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Typography, Card, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert, Tabs, Tab, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Pagination, Stack,
} from '@mui/material'
import {
  Outbox as SalidaIcon,
  Download as DownloadIcon,
  UploadFile as UploadIcon,
  Send as DespacharIcon,
  ReplyAll as DevolverIcon,
  Block as AnularIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { correspondenciaAPI, SalidasResponse } from '../../api/correspondencia'
import { Correspondencia } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import {
  estadoCorrespondencia, TIPOS_DOCUMENTO_SALIDA, MEDIOS_DESPACHO,
} from '../../utils/estadoCorrespondencia'

const TABS: { estado: string; label: string; countKey: keyof SalidasResponse['counts'] }[] = [
  { estado: 'por_despachar', label: 'Por despachar', countKey: 'por_despachar' },
  { estado: 'reservada', label: 'N° reservados', countKey: 'reservada' },
  { estado: 'devuelta', label: 'Devueltas', countKey: 'devuelta' },
  { estado: 'despachada', label: 'Despachadas', countKey: 'despachada' },
  { estado: 'anulada', label: 'Anuladas', countKey: 'anulada' },
]

const Salidas = () => {
  const { isAdmin, isOficial } = useAuth()
  const esPartes = isAdmin() || isOficial()

  const [tab, setTab] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [items, setItems] = useState<Correspondencia[]>([])
  const [counts, setCounts] = useState<SalidasResponse['counts']>({
    reservada: 0, por_despachar: 0, devuelta: 0, despachada: 0, anulada: 0,
  })
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await correspondenciaAPI.salidasListar({ estado: TABS[tab].estado, page })
      setItems(res.data.items)
      setLastPage(res.data.last_page)
      setCounts(res.data.counts)
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudieron cargar las salidas' })
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => { cargar() }, [cargar])

  // ===== Diálogo: reservar número / registrar salida =====
  const [reservaOpen, setReservaOpen] = useState(false)
  const [reservaForm, setReservaForm] = useState({ tipo_documento: 'oficio', materia: '', destinatario: '', numero: '' })
  const [reservaSerie, setReservaSerie] = useState<{ prefijo: string; anio: number } | null>(null)
  const [reservaLoading, setReservaLoading] = useState(false)

  // Sugiere el siguiente correlativo de la serie y pre-llena el número (editable).
  const cargarSiguienteNumero = async (tipo: string) => {
    try {
      const res = await correspondenciaAPI.salidaSiguienteNumero(tipo)
      setReservaForm((f) => ({ ...f, numero: String(res.data.numero) }))
      setReservaSerie({ prefijo: res.data.prefijo, anio: res.data.anio })
    } catch {
      setReservaSerie(null)
    }
  }

  const abrirReserva = () => {
    setReservaForm({ tipo_documento: 'oficio', materia: '', destinatario: '', numero: '' })
    setReservaSerie(null)
    setReservaOpen(true)
    cargarSiguienteNumero('oficio')
  }

  // Folio previsualizado a partir del número manual (mismo formato que el backend).
  const folioPreview = reservaSerie && reservaForm.numero
    ? `${reservaSerie.prefijo}-${reservaSerie.anio}-${String(reservaForm.numero).padStart(5, '0')}`
    : ''

  const handleReservar = async () => {
    setReservaLoading(true)
    try {
      const res = await correspondenciaAPI.salidaReservar({
        tipo_documento: reservaForm.tipo_documento,
        materia: reservaForm.materia.trim(),
        destinatario: reservaForm.destinatario || undefined,
        numero: reservaForm.numero ? parseInt(reservaForm.numero, 10) : undefined,
      })
      setMensaje({ tipo: 'success', texto: res.message || `Número reservado: ${res.data.folio}` })
      setReservaOpen(false)
      setReservaForm({ tipo_documento: 'oficio', materia: '', destinatario: '', numero: '' })
      setTab(1) // pestaña reservados
      setPage(1)
      cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err?.response?.data?.message || 'No se pudo reservar el número' })
    } finally {
      setReservaLoading(false)
    }
  }

  // ===== Diálogo: subir documento firmado =====
  const [subirTarget, setSubirTarget] = useState<Correspondencia | null>(null)
  const [subirForm, setSubirForm] = useState({ destinatario: '', firmante: '' })
  const [subirArchivo, setSubirArchivo] = useState<File | null>(null)
  const [subirLoading, setSubirLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const abrirSubir = (s: Correspondencia) => {
    setSubirTarget(s)
    setSubirForm({
      destinatario: s.remitente !== 'Por definir' ? s.remitente : '',
      firmante: s.firmante_nombre || '',
    })
    setSubirArchivo(null)
  }

  const handleSubir = async () => {
    if (!subirTarget || !subirArchivo) return
    setSubirLoading(true)
    try {
      const res = await correspondenciaAPI.salidaSubirDocumento(
        subirTarget.id, subirArchivo, subirForm.destinatario, subirForm.firmante,
      )
      setMensaje({ tipo: 'success', texto: res.message || 'Documento subido' })
      setSubirTarget(null)
      cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err?.response?.data?.message || 'No se pudo subir el documento' })
    } finally {
      setSubirLoading(false)
    }
  }

  // ===== Diálogo: despachar =====
  const [despacharTarget, setDespacharTarget] = useState<Correspondencia | null>(null)
  const [despachoForm, setDespachoForm] = useState({ medio: 'email', referencia: '' })
  const [despacharLoading, setDespacharLoading] = useState(false)

  const handleDespachar = async () => {
    if (!despacharTarget) return
    setDespacharLoading(true)
    try {
      const res = await correspondenciaAPI.salidaDespachar(despacharTarget.id, {
        medio_despacho: despachoForm.medio,
        referencia_despacho: despachoForm.referencia || undefined,
      })
      setMensaje({ tipo: 'success', texto: res.message || 'Salida despachada' })
      setDespacharTarget(null)
      setDespachoForm({ medio: 'email', referencia: '' })
      cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err?.response?.data?.message || 'No se pudo despachar' })
    } finally {
      setDespacharLoading(false)
    }
  }

  // ===== Diálogo: devolver / anular (comparten formato motivo) =====
  const [motivoTarget, setMotivoTarget] = useState<{ salida: Correspondencia; accion: 'devolver' | 'anular' } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [motivoLoading, setMotivoLoading] = useState(false)

  const handleMotivo = async () => {
    if (!motivoTarget || !motivo.trim()) return
    setMotivoLoading(true)
    try {
      const res = motivoTarget.accion === 'devolver'
        ? await correspondenciaAPI.salidaDevolver(motivoTarget.salida.id, motivo.trim())
        : await correspondenciaAPI.salidaAnular(motivoTarget.salida.id, motivo.trim())
      setMensaje({ tipo: 'success', texto: res.message || 'Listo' })
      setMotivoTarget(null)
      setMotivo('')
      cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err?.response?.data?.message || 'No se pudo completar la acción' })
    } finally {
      setMotivoLoading(false)
    }
  }

  const handleDescargar = async (s: Correspondencia) => {
    try {
      const blob = await correspondenciaAPI.salidaDescargarDocumento(s.id)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${s.folio}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo descargar el documento' })
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 1 }}>
        <Typography variant="h4" fontWeight="bold">
          <SalidaIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 32 }} />
          Correspondencia de Salida
        </Typography>
        <Button variant="contained" onClick={abrirReserva}>
          Reservar número
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Reserva el número del documento antes de imprimirlo y firmarlo; luego sube el PDF firmado
        para que Oficina de Partes lo despache al destinatario externo.
      </Typography>

      {mensaje && (
        <Alert severity={mensaje.tipo} sx={{ mb: 2 }} onClose={() => setMensaje(null)}>
          {mensaje.texto}
        </Alert>
      )}

      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => { setTab(v); setPage(1) }}
          variant="scrollable"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {TABS.map((t) => (
            <Tab key={t.estado} label={`${t.label} (${counts[t.countKey]})`} />
          ))}
        </Tabs>

        <TableContainer>
          <Table size="small" sx={{ minWidth: 900, '& td, & th': { py: 1 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Folio</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Destinatario</TableCell>
                <TableCell>Materia</TableCell>
                <TableCell>Solicitante</TableCell>
                <TableCell>Detalle</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No hay salidas en esta pestaña</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell><strong>{s.folio}</strong></TableCell>
                    <TableCell>{TIPOS_DOCUMENTO_SALIDA[s.tipo_documento_salida || ''] || s.tipo_documento_salida}</TableCell>
                    <TableCell>{s.remitente}</TableCell>
                    <TableCell sx={{ maxWidth: 260 }}>
                      <Typography variant="body2" noWrap title={s.descripcion}>{s.descripcion}</Typography>
                      {s.respuesta_a && (
                        <Chip size="small" variant="outlined" sx={{ mt: 0.25, height: 18, fontSize: 10 }}
                          label={`Responde a ${s.respuesta_a.folio || '#' + s.respuesta_a.id}`} />
                      )}
                    </TableCell>
                    <TableCell>{s.usuario?.nombre || '—'}</TableCell>
                    <TableCell>
                      {s.estado === 'despachada' && (
                        <Typography variant="caption" color="text.secondary">
                          {MEDIOS_DESPACHO[s.medio_despacho || ''] || s.medio_despacho}
                          {s.fecha_despacho ? ` · ${format(new Date(s.fecha_despacho), 'dd/MM/yyyy', { locale: es })}` : ''}
                        </Typography>
                      )}
                      {(s.estado === 'devuelta' || s.estado === 'anulada') && s.motivo_devolucion && (
                        <Typography variant="caption" color="error.main" title={s.motivo_devolucion}>
                          {s.motivo_devolucion.slice(0, 60)}{s.motivo_devolucion.length > 60 ? '…' : ''}
                        </Typography>
                      )}
                      {s.estado === 'por_despachar' && s.firmante_nombre && (
                        <Typography variant="caption" color="text.secondary">Firma: {s.firmante_nombre}</Typography>
                      )}
                      {s.estado === 'reservada' && (
                        <Chip size="small" label={estadoCorrespondencia(s.estado).label} color="warning" sx={{ height: 20 }} />
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      {s.documento_nombre && (
                        <Tooltip title="Descargar documento">
                          <IconButton size="small" onClick={() => handleDescargar(s)}><DownloadIcon /></IconButton>
                        </Tooltip>
                      )}
                      {(s.estado === 'reservada' || s.estado === 'devuelta') && (
                        <Tooltip title="Subir documento firmado">
                          <IconButton size="small" color="primary" onClick={() => abrirSubir(s)}><UploadIcon /></IconButton>
                        </Tooltip>
                      )}
                      {esPartes && s.estado === 'por_despachar' && (
                        <>
                          <Tooltip title="Despachar">
                            <IconButton size="small" color="success" onClick={() => setDespacharTarget(s)}><DespacharIcon /></IconButton>
                          </Tooltip>
                          <Tooltip title="Devolver con motivo">
                            <IconButton size="small" color="warning" onClick={() => setMotivoTarget({ salida: s, accion: 'devolver' })}><DevolverIcon /></IconButton>
                          </Tooltip>
                        </>
                      )}
                      {(s.estado === 'reservada' || s.estado === 'devuelta') && (
                        <Tooltip title="Anular folio">
                          <IconButton size="small" color="error" onClick={() => setMotivoTarget({ salida: s, accion: 'anular' })}><AnularIcon /></IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {lastPage > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
            <Pagination count={lastPage} page={page} onChange={(_, v) => setPage(v)} size="small" color="primary" />
          </Box>
        )}
      </Card>

      {/* ===== Reservar número ===== */}
      <Dialog open={reservaOpen} onClose={() => setReservaOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reservar número de salida</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              El número queda reservado de inmediato para que el documento se imprima y firme con él.
              Luego sube aquí el PDF firmado para enviarlo a despacho.
            </Alert>
            <TextField
              select fullWidth label="Tipo de documento"
              value={reservaForm.tipo_documento}
              onChange={(e) => {
                const tipo = e.target.value
                setReservaForm({ ...reservaForm, tipo_documento: tipo })
                cargarSiguienteNumero(tipo)
              }}
            >
              {Object.entries(TIPOS_DOCUMENTO_SALIDA).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth required type="number" label="Número"
              value={reservaForm.numero}
              onChange={(e) => setReservaForm({ ...reservaForm, numero: e.target.value })}
              helperText={
                folioPreview
                  ? `Folio: ${folioPreview}. Cero Papel aún no está integrado, indica el número manualmente.`
                  : 'Indica el número del documento (Cero Papel aún no está integrado).'
              }
              inputProps={{ min: 1 }}
            />
            <TextField
              fullWidth required label="Materia"
              placeholder="Asunto del documento…"
              value={reservaForm.materia}
              onChange={(e) => setReservaForm({ ...reservaForm, materia: e.target.value })}
            />
            <TextField
              fullWidth label="Destinatario externo (opcional por ahora)"
              placeholder="Ej: Ministerio de Desarrollo Social"
              value={reservaForm.destinatario}
              onChange={(e) => setReservaForm({ ...reservaForm, destinatario: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReservaOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleReservar} disabled={reservaLoading || !reservaForm.materia.trim() || !reservaForm.numero}>
            {reservaLoading ? <CircularProgress size={20} /> : 'Reservar número'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Subir documento firmado ===== */}
      <Dialog open={!!subirTarget} onClose={() => setSubirTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Subir documento firmado · {subirTarget?.folio}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {subirTarget?.estado === 'devuelta' && subirTarget?.motivo_devolucion && (
              <Alert severity="warning">Devuelta por Oficina de Partes: {subirTarget.motivo_devolucion}</Alert>
            )}
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={(e) => setSubirArchivo(e.target.files?.[0] ?? null)} />
            <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
              {subirArchivo ? subirArchivo.name : 'Seleccionar PDF firmado'}
            </Button>
            <TextField
              fullWidth required label="Destinatario externo"
              value={subirForm.destinatario}
              onChange={(e) => setSubirForm({ ...subirForm, destinatario: e.target.value })}
            />
            <TextField
              fullWidth required label="Firmante del documento"
              placeholder="Ej: Patricio Fernández, Alcalde"
              value={subirForm.firmante}
              onChange={(e) => setSubirForm({ ...subirForm, firmante: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubirTarget(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubir}
            disabled={subirLoading || !subirArchivo || !subirForm.destinatario.trim() || !subirForm.firmante.trim()}>
            {subirLoading ? <CircularProgress size={20} /> : 'Enviar a despacho'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Despachar ===== */}
      <Dialog open={!!despacharTarget} onClose={() => setDespacharTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Despachar · {despacharTarget?.folio}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select fullWidth label="Medio de despacho"
              value={despachoForm.medio}
              onChange={(e) => setDespachoForm({ ...despachoForm, medio: e.target.value })}
            >
              {Object.entries(MEDIOS_DESPACHO).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth label="Referencia (opcional)"
              placeholder="N° de seguimiento, correo de destino…"
              value={despachoForm.referencia}
              onChange={(e) => setDespachoForm({ ...despachoForm, referencia: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDespacharTarget(null)}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={handleDespachar} disabled={despacharLoading}>
            {despacharLoading ? <CircularProgress size={20} /> : 'Confirmar despacho'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Devolver / Anular ===== */}
      <Dialog open={!!motivoTarget} onClose={() => setMotivoTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {motivoTarget?.accion === 'devolver' ? 'Devolver al solicitante' : 'Anular folio'} · {motivoTarget?.salida.folio}
        </DialogTitle>
        <DialogContent>
          {motivoTarget?.accion === 'anular' && (
            <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
              El folio quedará anulado con su motivo en acta y no se reutilizará.
            </Alert>
          )}
          <TextField
            fullWidth required multiline minRows={2} label="Motivo"
            sx={{ mt: motivoTarget?.accion === 'anular' ? 0 : 1 }}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMotivoTarget(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color={motivoTarget?.accion === 'devolver' ? 'warning' : 'error'}
            onClick={handleMotivo}
            disabled={motivoLoading || !motivo.trim()}
          >
            {motivoLoading ? <CircularProgress size={20} /> : (motivoTarget?.accion === 'devolver' ? 'Devolver' : 'Anular')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Salidas
