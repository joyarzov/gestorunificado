import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Chip, CircularProgress, Stack, Alert, Divider,
} from '@mui/material'
import {
  Forum as ForumIcon,
  Send as SendIcon,
  AttachFile as AttachIcon,
  Download as DownloadIcon,
  InsertDriveFile as FileIcon,
  TrendingFlat as DerivIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { correspondenciaAPI, HiloItem, HiloResponse, HiloAdjunto } from '../../api/correspondencia'

const EXT_PERMITIDAS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rar'

const formatTamanio = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

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
    setArchivos((prev) => [...prev, ...nuevos])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const quitarArchivo = (idx: number) => setArchivos((prev) => prev.filter((_, i) => i !== idx))

  const handleEnviar = async () => {
    if (!mensaje.trim() && archivos.length === 0) return
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

  const renderDerivacion = (it: HiloItem) => (
    <Box key={`d-${it.id}`} sx={{ my: 1.5, color: 'text.secondary' }}>
      {/* La frase va FUERA del Divider: dentro de él no se quiebra de línea y
          con los cargos el texto largo se salía de la tarjeta. */}
      <Divider>
        <DerivIcon fontSize="small" sx={{ display: 'block', color: 'text.disabled' }} />
      </Divider>
      <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 0.5, px: 1 }}>
        {conCargo(it.de)}
        {it.actuando_como && (
          <>
            {', como subrogante de '}
            <strong>{it.actuando_como.nombre}</strong>
            {it.actuando_como.cargo ? ` (${it.actuando_como.cargo})` : ''}
            {','}
          </>
        )}
        {' derivó a '}
        {conCargo(it.para)}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
        <Chip
          label={it.estado}
          size="small"
          color={it.estado === 'recibido' ? 'success' : 'warning'}
          sx={{ height: 18, fontSize: 10 }}
        />
        <Typography variant="caption">· {fechaCorta(it.fecha)}</Typography>
      </Box>
      {it.observaciones && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5, fontStyle: 'italic' }}>
          "{it.observaciones}"
        </Typography>
      )}
    </Box>
  )

  const renderMensaje = (it: HiloItem) => (
    <Box key={`m-${it.id}`} sx={{ display: 'flex', justifyContent: it.es_mio ? 'flex-end' : 'flex-start', my: 1 }}>
      <Box
        sx={{
          maxWidth: '82%',
          bgcolor: it.es_mio ? '#E3F0FA' : '#F4F4F4',
          border: '1px solid',
          borderColor: it.es_mio ? '#bfdcf0' : '#e6e6e6',
          borderRadius: 2,
          px: 1.5,
          py: 1,
        }}
      >
        <Typography variant="caption" fontWeight="bold" color="primary">
          {it.autor?.nombre}
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
                onClick={() => descargarAdjunto(adj)}
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
    </Box>
  )

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

            <Box sx={{ maxHeight: 460, overflowY: 'auto', pr: 0.5 }}>
              {hilo && hilo.items.length > 0 ? (
                hilo.items.map((it) => (it.tipo === 'derivacion' ? renderDerivacion(it) : renderMensaje(it)))
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
                      PDF, Word, Excel, PowerPoint, RAR · máx. 20 MB c/u
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
    </Card>
  )
}

export default ConversacionHilo
