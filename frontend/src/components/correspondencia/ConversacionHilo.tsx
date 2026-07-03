import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Chip, CircularProgress, Stack, Alert,
  Dialog, DialogTitle, DialogContent, IconButton,
} from '@mui/material'
import {
  Forum as ForumIcon,
  Send as SendIcon,
  AttachFile as AttachIcon,
  Download as DownloadIcon,
  InsertDriveFile as FileIcon,
  TrendingFlat as DerivIcon,
  Close as CloseIcon,
  ChatBubbleOutline as ChatIcon,
  Check as CheckIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  ExpandLess as VerMasIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { correspondenciaAPI, HiloItem, HiloResponse, HiloAdjunto } from '../../api/correspondencia'

const EXT_PERMITIDAS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rar,.jpg,.jpeg,.png'

/** PDF e imágenes se abren en el visor; el resto se descarga. */
const esVisualizable = (adj: HiloAdjunto): 'pdf' | 'imagen' | null => {
  const mime = (adj.tipo_mime || '').toLowerCase()
  const nombre = adj.nombre.toLowerCase()
  if (mime.includes('pdf') || nombre.endsWith('.pdf')) return 'pdf'
  if (mime.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/.test(nombre)) return 'imagen'
  return null
}

const formatTamanio = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

// Límites del adjunto en el hilo, alineados con el backend
// (CorrespondenciaMensajeController: max 20 MB y estas extensiones).
const MAX_ADJUNTO_BYTES = 20 * 1024 * 1024
// Tope del total de un envío, con margen bajo el post_max_size del servidor (25 MB).
const MAX_TOTAL_BYTES = 23 * 1024 * 1024
const EXTENSIONES_PERMITIDAS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rar', 'jpg', 'jpeg', 'png']

const fechaCorta = (iso: string) => {
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: es })
  } catch {
    return iso
  }
}

interface Props {
  correspondenciaId: number
}

const ConversacionHilo = ({ correspondenciaId }: Props) => {
  const [hilo, setHilo] = useState<HiloResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    try {
      const data = await correspondenciaAPI.obtenerHilo(correspondenciaId)
      setHilo(data)
    } catch {
      setError('No se pudo cargar la conversación')
    } finally {
      setLoading(false)
    }
  }, [correspondenciaId])

  useEffect(() => { cargar() }, [cargar])

  const handleSeleccionarArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevos = Array.from(e.target.files ?? [])
    // Validar en el cliente (tamaño y tipo) para dar feedback inmediato: antes
    // un archivo demasiado grande fallaba en el servidor sin mensaje claro.
    const rechazados: string[] = []
    const aceptados = nuevos.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
        rechazados.push(`${f.name}: tipo .${ext} no permitido`)
        return false
      }
      if (f.size > MAX_ADJUNTO_BYTES) {
        rechazados.push(`${f.name}: ${formatTamanio(f.size)} supera el máximo de 20 MB`)
        return false
      }
      return true
    })
    if (rechazados.length) {
      setError(rechazados.join(' · '))
    }
    if (aceptados.length) {
      setArchivos((prev) => [...prev, ...aceptados])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const quitarArchivo = (idx: number) => setArchivos((prev) => prev.filter((_, i) => i !== idx))

  const handleEnviar = async () => {
    if (!mensaje.trim() && archivos.length === 0) return
    // El servidor descarta el envío completo si el total supera su límite
    // (~25 MB) sin dar un error claro; se valida aquí para avisar antes.
    const totalBytes = archivos.reduce((s, f) => s + f.size, 0)
    if (totalBytes > MAX_TOTAL_BYTES) {
      setError(`El total de adjuntos (${formatTamanio(totalBytes)}) supera el máximo de 23 MB. Envíalos en mensajes separados.`)
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await correspondenciaAPI.enviarMensaje(correspondenciaId, mensaje.trim(), archivos)
      setMensaje('')
      setArchivos([])
      await cargar()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo enviar el mensaje')
    } finally {
      setEnviando(false)
    }
  }

  const descargarAdjunto = async (adj: HiloAdjunto) => {
    try {
      const blob = await correspondenciaAPI.descargarMensajeAdjunto(adj.id)
      const url = URL.createObjectURL(blob as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = adj.nombre
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('No se pudo descargar el adjunto')
    }
  }

  // Visor para PDF e imágenes (el resto siempre se descarga)
  const [viewer, setViewer] = useState<{ url: string; nombre: string; tipo: 'pdf' | 'imagen' } | null>(null)

  const abrirAdjunto = async (adj: HiloAdjunto) => {
    const tipo = esVisualizable(adj)
    if (!tipo) {
      descargarAdjunto(adj)
      return
    }
    try {
      const blob = await correspondenciaAPI.descargarMensajeAdjunto(adj.id)
      const mime = tipo === 'pdf' ? 'application/pdf' : (adj.tipo_mime || 'image/png')
      const url = URL.createObjectURL(new Blob([blob as Blob], { type: mime }))
      setViewer({ url, nombre: adj.nombre, tipo })
    } catch {
      setError('No se pudo abrir el adjunto')
    }
  }

  const cerrarViewer = () => {
    if (viewer) URL.revokeObjectURL(viewer.url)
    setViewer(null)
  }

  // "Nombre (Cargo)" o el departamento como respaldo.
  const conCargo = (p?: { usuario?: string | null; cargo?: string | null; departamento?: string | null }) => (
    p?.usuario ? (
      <>
        <strong>{p.usuario}</strong>
        {p.cargo ? ` (${p.cargo})` : ''}
      </>
    ) : (
      <strong>{p?.departamento || '—'}</strong>
    )
  )

  // ===== Línea de tiempo: ícono y color por tipo de hito =====
  const iconoItem = (it: HiloItem): { icon: React.ReactNode; bg: string } => {
    if (it.tipo === 'derivacion') return { icon: <DerivIcon sx={{ fontSize: 14 }} />, bg: '#0071BC' }
    if (it.tipo === 'mensaje') return { icon: <ChatIcon sx={{ fontSize: 12 }} />, bg: '#28A9E3' }
    if (it.evento_tipo === 'archivada') return { icon: <ArchiveIcon sx={{ fontSize: 13 }} />, bg: '#4D4D4D' }
    if (it.evento_tipo === 'desarchivada') return { icon: <UnarchiveIcon sx={{ fontSize: 13 }} />, bg: '#ed6c02' }
    return { icon: <CheckIcon sx={{ fontSize: 14 }} />, bg: '#2e7d32' } // acuse de recibo
  }

  const contenidoDerivacion = (it: HiloItem) => {
    const varios = (it.destinatarios?.length ?? 0) > 1
    return (
      <>
        <Typography variant="body2" sx={{ lineHeight: 1.45 }}>
          {conCargo(it.de)}
          {it.actuando_como && (
            <>
              {', como subrogante de '}
              <strong>{it.actuando_como.nombre}</strong>
              {it.actuando_como.cargo ? ` (${it.actuando_como.cargo})` : ''}
              {','}
            </>
          )}
          {varios
            ? ` derivó a ${it.destinatarios!.length} funcionarios:`
            : <>{' derivó a '}{conCargo(it.para)}</>}
        </Typography>

        {/* Lista de destinatarios del lote, cada uno con su estado de acuse. */}
        {varios && (
          <Box component="ul" sx={{ my: 0.4, pl: 2.2 }}>
            {it.destinatarios!.map((dst, i) => (
              <Box component="li" key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.2 }}>
                <Typography variant="body2">
                  <strong>{dst.usuario || dst.departamento || '—'}</strong>
                  {dst.cargo ? ` · ${dst.cargo}` : ''}
                </Typography>
                <Chip
                  label={dst.acuso ? 'recibido' : 'pendiente'}
                  size="small"
                  color={dst.acuso ? 'success' : 'warning'}
                  sx={{ height: 17, fontSize: 10 }}
                />
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.4 }}>
          {!varios && (
            <Chip
              label={it.estado}
              size="small"
              color={it.estado === 'recibido' ? 'success' : 'warning'}
              sx={{ height: 18, fontSize: 10 }}
            />
          )}
          <Typography variant="caption" color="text.secondary">{fechaCorta(it.fecha)}</Typography>
        </Box>
        {it.observaciones && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4, fontStyle: 'italic' }}>
            "{it.observaciones}"
          </Typography>
        )}
      </>
    )
  }

  const contenidoEvento = (it: HiloItem) => (
    <Typography variant="body2" sx={{ color: 'text.secondary', pt: 0.25 }}>
      <strong>{it.texto}</strong>
      <Typography component="span" variant="caption" sx={{ ml: 0.75 }}>{fechaCorta(it.fecha)}</Typography>
    </Typography>
  )

  const contenidoMensaje = (it: HiloItem) => (
    <Box
      sx={{
        maxWidth: 520,
        bgcolor: it.es_mio ? '#E3F0FA' : '#F4F4F4',
        border: '1px solid',
        borderColor: it.es_mio ? '#bfdcf0' : '#e6e6e6',
        borderRadius: 2,
        px: 1.5,
        py: 1,
      }}
    >
      <Typography variant="caption" fontWeight="bold" color="primary">
        {it.autor?.nombre}{it.es_mio ? ' (tú)' : ''}
        {it.autor?.cargo && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
            {` · ${it.autor.cargo}`}
          </Typography>
        )}
      </Typography>
      {it.mensaje && (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>
          {it.mensaje}
        </Typography>
      )}
      {it.adjuntos && it.adjuntos.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 0.75 }}>
          {it.adjuntos.map((adj) => (
            <Chip
              key={adj.id}
              icon={<FileIcon />}
              label={`${adj.nombre} · ${formatTamanio(adj.tamanio_bytes)}`}
              onClick={() => abrirAdjunto(adj)}
              onDelete={() => descargarAdjunto(adj)}
              deleteIcon={<DownloadIcon />}
              size="small"
              variant="outlined"
              sx={{ maxWidth: '100%', justifyContent: 'flex-start' }}
            />
          ))}
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}>
        {fechaCorta(it.fecha)}
      </Typography>
    </Box>
  )

  // Fila de la línea de tiempo: punto con ícono + conector + contenido
  const TimelineRow = ({ it, last }: { it: HiloItem; last: boolean }) => {
    const { icon, bg } = iconoItem(it)
    return (
      <Box sx={{ display: 'flex', gap: 1.25 }}>
        <Box sx={{ width: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
          <Box sx={{
            width: 24, height: 24, borderRadius: '50%', bgcolor: bg, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', mt: 0.25,
          }}>
            {icon}
          </Box>
          {!last && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', my: 0.5, borderRadius: 1 }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, pb: last ? 0.5 : 2 }}>
          {it.tipo === 'derivacion' ? contenidoDerivacion(it)
            : it.tipo === 'evento' ? contenidoEvento(it)
            : contenidoMensaje(it)}
        </Box>
      </Box>
    )
  }

  // "Volver atrás": se muestran los últimos N y un botón carga los anteriores
  const [visibles, setVisibles] = useState(15)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  const itemsMostrados = hilo ? hilo.items.slice(Math.max(0, hilo.items.length - visibles)) : []
  const ocultos = hilo ? hilo.items.length - itemsMostrados.length : 0

  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    autoScrollRef.current = true
  }, [hilo?.items.length, visibles])

  const verAnteriores = () => {
    autoScrollRef.current = false
    setVisibles((v) => v + 15)
  }

  const diaDe = (iso: string) => {
    try { return format(new Date(iso), "d 'de' MMMM yyyy", { locale: es }) } catch { return '' }
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <ForumIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Conversación
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}

            <Box ref={scrollRef} sx={{ maxHeight: 460, overflowY: 'auto', pr: 0.5 }}>
              {hilo && hilo.items.length > 0 ? (
                <>
                  {ocultos > 0 && (
                    <Box sx={{ textAlign: 'center', mb: 1.5 }}>
                      <Button size="small" startIcon={<VerMasIcon />} onClick={verAnteriores}>
                        Ver {Math.min(15, ocultos)} {ocultos === 1 ? 'registro anterior' : 'registros anteriores'} ({ocultos})
                      </Button>
                    </Box>
                  )}
                  {itemsMostrados.map((it, idx) => {
                    const diaActual = diaDe(it.fecha)
                    const diaPrevio = idx > 0 ? diaDe(itemsMostrados[idx - 1].fecha) : null
                    return (
                      <Box key={`${it.tipo}-${it.id}`}>
                        {diaActual !== diaPrevio && (
                          <Box sx={{ textAlign: 'center', my: 1.25 }}>
                            <Chip label={diaActual} size="small" variant="outlined" sx={{ height: 20, fontSize: 11, color: 'text.secondary' }} />
                          </Box>
                        )}
                        <TimelineRow it={it} last={idx === itemsMostrados.length - 1} />
                      </Box>
                    )
                  })}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  Aún no hay derivaciones ni mensajes.
                </Typography>
              )}
            </Box>

            {hilo?.puede_responder && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee' }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={6}
                  size="small"
                  placeholder="Escribe un mensaje…"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  disabled={enviando}
                />
                {archivos.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                    {archivos.map((f, idx) => (
                      <Chip
                        key={idx}
                        icon={<FileIcon />}
                        label={`${f.name} · ${formatTamanio(f.size)}`}
                        onDelete={() => quitarArchivo(idx)}
                        deleteIcon={<CloseIcon />}
                        size="small"
                      />
                    ))}
                  </Stack>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                  <Box>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={EXT_PERMITIDAS}
                      style={{ display: 'none' }}
                      onChange={handleSeleccionarArchivos}
                    />
                    <Button
                      size="small"
                      startIcon={<AttachIcon />}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={enviando}
                    >
                      Adjuntar
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      PDF, imágenes, Word, Excel, PowerPoint, RAR · máx. 20 MB c/u
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                    onClick={handleEnviar}
                    disabled={enviando || (!mensaje.trim() && archivos.length === 0)}
                  >
                    Enviar
                  </Button>
                </Box>
              </Box>
            )}
          </>
        )}
      </CardContent>

      {/* Visor de adjuntos (PDF e imágenes; el resto se descarga) */}
      <Dialog open={!!viewer} onClose={cerrarViewer} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          <Typography variant="subtitle1" noWrap sx={{ pr: 2 }}>{viewer?.nombre}</Typography>
          <Box>
            <IconButton size="small" title="Descargar" onClick={() => {
              if (!viewer) return
              const a = document.createElement('a')
              a.href = viewer.url
              a.download = viewer.nombre
              a.click()
            }}>
              <DownloadIcon />
            </IconButton>
            <IconButton size="small" onClick={cerrarViewer}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: '78vh', display: 'flex', justifyContent: 'center', bgcolor: '#525659' }}>
          {viewer?.tipo === 'pdf' ? (
            <iframe src={viewer.url} title={viewer.nombre} style={{ width: '100%', height: '100%', border: 'none' }} />
          ) : viewer ? (
            <img src={viewer.url} alt={viewer.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', alignSelf: 'center' }} />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default ConversacionHilo
