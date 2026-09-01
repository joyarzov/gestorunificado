import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Badge, Box, CircularProgress, Divider, Fab, IconButton, InputAdornment,
  List, ListItemButton, ListItemText, Popover, Tab, Tabs, TextField,
  Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import {
  Forum as ChatIcon,
  Send as SendIcon,
  ArrowBack as VolverIcon,
  VolumeUp as ConSonidoIcon,
  VolumeOff as SinSonidoIcon,
} from '@mui/icons-material'
import { formatDistanceToNow, format, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePresencia } from '../../hooks/usePresencia'
import { useChat } from '../../hooks/useChat'
import { ChatInterlocutor, EstadoPresencia, UsuarioPresencia } from '../../api/common'
import PuntoPresencia from '../common/PuntoPresencia'
import { estaSilenciado, silenciar } from '../../utils/sonidoChat'
import { useAuth } from '../../contexts/AuthContext'

const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')

const Avatarcito = ({ nombre, estado }: { nombre: string; estado?: EstadoPresencia }) => (
  <Box sx={{ position: 'relative', mr: 1.5 }}>
    <Box
      sx={{
        width: 32, height: 32, borderRadius: '50%',
        bgcolor: estado === 'desconectado' || !estado ? 'grey.300' : 'primary.main',
        color: estado === 'desconectado' || !estado ? 'text.secondary' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}
    >
      {iniciales(nombre)}
    </Box>
    {estado && (
      <Box sx={{ position: 'absolute', bottom: -1, right: -1, bgcolor: '#fff', borderRadius: '50%', p: '2px', lineHeight: 0 }}>
        <PuntoPresencia estado={estado} size={9} />
      </Box>
    )}
  </Box>
)

const horaCorta = (iso: string) => {
  const d = new Date(iso)
  return isToday(d) ? format(d, 'HH:mm') : format(d, "d MMM HH:mm", { locale: es })
}

/**
 * Globo flotante de la plataforma: quién está conectado y el chat interno.
 *
 * Vive en el layout, así que acompaña al usuario mientras navega entre
 * Correspondencia, Expedientes y Cero Papel sin recargarse ni perder el hilo
 * abierto.
 *
 * Va abajo a la IZQUIERDA: a la derecha chocaba con los botones flotantes de
 * acción de varias pantallas. No se muestra en pantallas chicas.
 */
const GloboChat = () => {
  const theme = useTheme()
  const esPantallaChica = useMediaQuery(theme.breakpoints.down('md'))
  const { isAuthenticated } = useAuth()
  const autenticado = isAuthenticated()
  const activo = autenticado && !esPantallaChica

  const [ancla, setAncla] = useState<HTMLElement | null>(null)
  const [tab, setTab] = useState(0)
  const [destinatario, setDestinatario] = useState<ChatInterlocutor | null>(null)
  const [conversacionId, setConversacionId] = useState<number | null>(null)
  const [borrador, setBorrador] = useState('')
  const [silencio, setSilencio] = useState(estaSilenciado)
  const [enviando, setEnviando] = useState(false)
  const finRef = useRef<HTMLDivElement | null>(null)

  const abierto = Boolean(ancla)
  const { usuarios, totalEnLinea } = usePresencia(activo)
  const {
    conversaciones, mensajes, setMensajes, noLeidos,
    cargandoHilo, cargarConversaciones, cargarHilo, enviar,
  } = useChat(activo, abierto ? conversacionId : null)

  const presenciaPorId = useMemo(() => {
    const m: Record<number, EstadoPresencia> = {}
    usuarios.forEach((u: UsuarioPresencia) => { m[u.id] = u.estado })
    return m
  }, [usuarios])

  // Al abrir el panel se refresca la lista: el badge solo trae el contador.
  useEffect(() => {
    if (abierto) cargarConversaciones()
  }, [abierto, cargarConversaciones])

  // Baja al final solo cuando LLEGA un mensaje, no en cada sondeo: el hilo se
  // recarga cada 5 s y, si se reaccionara a la recarga completa, el scroll
  // saltaría al final todo el tiempo e impediría leer lo anterior.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end' })
  }, [mensajes.length])

  if (!activo) return null

  const enHilo = destinatario !== null

  const abrirConPersona = (u: UsuarioPresencia) => {
    // Si ya existe conversación con esa persona, se retoma; si no, la creará
    // el primer mensaje enviado.
    const previa = conversaciones.find(c => c.interlocutor?.id === u.id)
    setDestinatario({ id: u.id, nombre: u.nombre, cargo: u.cargo })
    setConversacionId(previa?.id ?? null)
    setMensajes([])
    if (previa) cargarHilo(previa.id, true)
  }

  const abrirConversacion = (id: number, interlocutor: ChatInterlocutor | null) => {
    if (!interlocutor) return
    setDestinatario(interlocutor)
    setConversacionId(id)
    setMensajes([])
    cargarHilo(id, true)
  }

  const volver = () => {
    setDestinatario(null)
    setConversacionId(null)
    setMensajes([])
    cargarConversaciones()
  }

  const mandar = async () => {
    const texto = borrador.trim()
    if (!texto || !destinatario || enviando) return
    setEnviando(true)
    try {
      const id = await enviar(destinatario.id, texto)
      setBorrador('')
      if (id && !conversacionId) setConversacionId(id)
    } catch {
      // El mensaje queda en el cuadro para reintentar; no se pierde lo escrito.
    } finally {
      setEnviando(false)
    }
  }

  const conectados = usuarios.filter(u => u.estado === 'en_linea')
  const resto = usuarios.filter(u => u.estado !== 'en_linea')

  return (
    <>
      <Tooltip title={noLeidos > 0
        ? `${noLeidos} mensaje${noLeidos === 1 ? '' : 's'} sin leer`
        : `${totalEnLinea} ${totalEnLinea === 1 ? 'persona conectada' : 'personas conectadas'}`}>
        <Fab
          color="primary"
          size="medium"
          onClick={(e) => setAncla(e.currentTarget)}
          sx={{ position: 'fixed', bottom: 24, left: 24, zIndex: (t) => t.zIndex.drawer + 2 }}
          aria-label="Abrir chat y ver quién está conectado"
        >
          <Badge
            badgeContent={noLeidos > 0 ? noLeidos : totalEnLinea}
            color={noLeidos > 0 ? 'error' : 'success'}
            overlap="circular"
          >
            <ChatIcon />
          </Badge>
        </Fab>
      </Tooltip>

      <Popover
        open={abierto}
        anchorEl={ancla}
        onClose={() => setAncla(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 340, height: 480, borderRadius: 2, display: 'flex', flexDirection: 'column' } } }}
      >
        {enHilo ? (
          <>
            <Box sx={{ px: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
              <IconButton size="small" onClick={volver} aria-label="Volver"><VolverIcon fontSize="small" /></IconButton>
              <Avatarcito nombre={destinatario!.nombre} estado={presenciaPorId[destinatario!.id]} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} noWrap>{destinatario!.nombre}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {presenciaPorId[destinatario!.id] === 'en_linea' ? 'En línea' : (destinatario!.cargo || '')}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1, bgcolor: 'grey.50' }}>
              {cargandoHilo ? (
                <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={22} /></Box>
              ) : mensajes.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Aún no se han escrito. Escribe el primer mensaje.
                  </Typography>
                </Box>
              ) : (
                mensajes.map(m => (
                  <Box key={m.id} sx={{ display: 'flex', justifyContent: m.mio ? 'flex-end' : 'flex-start', mb: 0.75 }}>
                    <Box sx={{
                      maxWidth: '78%',
                      bgcolor: m.mio ? 'primary.main' : '#fff',
                      color: m.mio ? '#fff' : 'text.primary',
                      border: m.mio ? 'none' : '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2, px: 1.25, py: 0.75,
                    }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {m.cuerpo}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', textAlign: 'right', fontSize: 10 }}>
                        {horaCorta(m.fecha)}
                      </Typography>
                    </Box>
                  </Box>
                ))
              )}
              <div ref={finRef} />
            </Box>

            <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Escribe un mensaje…"
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mandar() }
                }}
                multiline
                maxRows={3}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" color="primary" onClick={mandar} disabled={!borrador.trim() || enviando}>
                        <SendIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: 10 }}>
                Conversación informal
              </Typography>
            </Box>
          </>
        ) : (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 42 }}>
              <Tab label={`En línea (${totalEnLinea})`} sx={{ minHeight: 42, fontSize: 13 }} />
              <Tab
                label={noLeidos > 0 ? `Chats (${noLeidos})` : 'Chats'}
                sx={{ minHeight: 42, fontSize: 13, fontWeight: noLeidos > 0 ? 700 : 400 }}
              />
            </Tabs>

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {tab === 0 && (
                <List dense disablePadding>
                  {conectados.length === 0 && (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        No hay nadie más conectado en este momento.
                      </Typography>
                    </Box>
                  )}
                  {conectados.map(u => (
                    <ListItemButton key={u.id} onClick={() => abrirConPersona(u)}>
                      <Avatarcito nombre={u.nombre} estado={u.estado} />
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{u.nombre}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">
                          {[u.cargo, u.departamento].filter(Boolean).join(' · ') || '—'}
                        </Typography>}
                      />
                    </ListItemButton>
                  ))}

                  {resto.length > 0 && (
                    <>
                      <Divider />
                      <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                        No conectados ({resto.length})
                      </Typography>
                      {resto.map(u => (
                        <ListItemButton key={u.id} onClick={() => abrirConPersona(u)}>
                          <Avatarcito nombre={u.nombre} estado={u.estado} />
                          <ListItemText
                            primary={<Typography variant="body2">{u.nombre}</Typography>}
                            secondary={<Typography variant="caption" color="text.secondary">
                              {u.visto_at
                                ? `activo hace ${formatDistanceToNow(new Date(u.visto_at), { locale: es })}`
                                : [u.cargo, u.departamento].filter(Boolean).join(' · ') || '—'}
                            </Typography>}
                          />
                        </ListItemButton>
                      ))}
                    </>
                  )}
                </List>
              )}

              {tab === 1 && (
                <List dense disablePadding>
                  {conversaciones.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        No tienes conversaciones todavía.
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Abre la pestaña "En línea" y elige a quién escribir.
                      </Typography>
                    </Box>
                  ) : conversaciones.map(c => (
                    <ListItemButton key={c.id} onClick={() => abrirConversacion(c.id, c.interlocutor)}>
                      <Avatarcito nombre={c.interlocutor?.nombre || '?'} estado={c.interlocutor ? presenciaPorId[c.interlocutor.id] : undefined} />
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" fontWeight={c.no_leidos > 0 ? 700 : 500} noWrap sx={{ flex: 1 }}>
                              {c.interlocutor?.nombre}
                            </Typography>
                            {c.ultimo_mensaje && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                                {horaCorta(c.ultimo_mensaje.fecha)}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color={c.no_leidos > 0 ? 'text.primary' : 'text.secondary'} noWrap
                            sx={{ fontWeight: c.no_leidos > 0 ? 600 : 400, display: 'block' }}>
                            {c.ultimo_mensaje
                              ? `${c.ultimo_mensaje.mio ? 'Tú: ' : ''}${c.ultimo_mensaje.cuerpo}`
                              : 'Sin mensajes'}
                          </Typography>
                        }
                      />
                      {c.no_leidos > 0 && (
                        <Badge badgeContent={c.no_leidos} color="error" sx={{ mr: 1.5 }} />
                      )}
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>

            <Box sx={{ px: 2, py: 0.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, flex: 1 }}>
                "En línea" significa que la persona tiene la plataforma a la vista.
              </Typography>
              <Tooltip title={silencio ? 'Activar el aviso sonoro' : 'Silenciar el aviso sonoro'}>
                <IconButton
                  size="small"
                  onClick={() => { const v = !silencio; setSilencio(v); silenciar(v) }}
                  aria-label={silencio ? 'Activar sonido' : 'Silenciar sonido'}
                >
                  {silencio ? <SinSonidoIcon fontSize="small" /> : <ConSonidoIcon fontSize="small" color="primary" />}
                </IconButton>
              </Tooltip>
            </Box>
          </>
        )}
      </Popover>
    </>
  )
}

export default GloboChat
