import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material'
import {
  Notifications as NotificationsIcon,
  Circle as CircleIcon,
  DoneAll as DoneAllIcon,
} from '@mui/icons-material'
import { notificacionesAPI } from '../api/common'
import { Notificacion } from '../types'
import { parseISO, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Etiqueta y color por módulo de origen (debe coincidir con config/notificaciones.php)
const MODULO_INFO: Record<string, { label: string; color: string }> = {
  cero_papel: { label: 'Cero Papel', color: '#0071BC' },
  correspondencia: { label: 'Correspondencia', color: '#28A9E3' },
  oirs: { label: 'OIRS', color: '#EB1B78' },
}

const Notificaciones = () => {
  const navigate = useNavigate()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificacionesAPI.listar()
      if (res.success) setNotificaciones(res.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const hayNoLeidas = notificaciones.some((n) => !n.leida)

  const handleClick = async (notif: Notificacion) => {
    if (!notif.leida) {
      try {
        await notificacionesAPI.marcarLeida(notif.id)
        setNotificaciones((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, leida: true } : n))
        )
      } catch {
        // ignore
      }
    }
    const url = notif.data?.url
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
      navigate(url)
    }
  }

  const marcarTodas = async () => {
    try {
      await notificacionesAPI.marcarTodasLeidas()
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
    } catch {
      // ignore
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <NotificationsIcon color="primary" sx={{ fontSize: 32 }} />
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Notificaciones
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Historial de tus notificaciones más recientes.
            </Typography>
          </Box>
        </Box>
        {hayNoLeidas && (
          <Button variant="outlined" startIcon={<DoneAllIcon />} onClick={marcarTodas}>
            Marcar todas como leídas
          </Button>
        )}
      </Box>

      <Card>
        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : notificaciones.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No tienes notificaciones.
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {notificaciones.map((notif, i) => (
              <Box key={notif.id}>
                {i > 0 && <Divider />}
                <ListItem
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    cursor: 'pointer',
                    bgcolor: notif.leida ? 'transparent' : 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                  onClick={() => handleClick(notif)}
                >
                  <ListItemIcon sx={{ minWidth: 24, alignSelf: 'flex-start', mt: 0.75 }}>
                    <CircleIcon
                      sx={{ fontSize: 9, color: notif.leida ? 'transparent' : 'primary.main' }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        {notif.modulo && MODULO_INFO[notif.modulo] && (
                          <Chip
                            label={MODULO_INFO[notif.modulo].label}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: 10,
                              fontWeight: 'bold',
                              bgcolor: MODULO_INFO[notif.modulo].color,
                              color: '#fff',
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          fontWeight={notif.leida ? 'medium' : 'bold'}
                          sx={{ lineHeight: 1.3 }}
                        >
                          {notif.titulo}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.35 }}>
                          {notif.mensaje}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                          {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true, locale: es })}
                        </Typography>
                      </Box>
                    }
                    sx={{ my: 0 }}
                  />
                </ListItem>
              </Box>
            ))}
          </List>
        )}
      </Card>
    </Box>
  )
}

export default Notificaciones
