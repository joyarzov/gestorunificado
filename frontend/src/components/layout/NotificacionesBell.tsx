import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Divider,
  Chip,
} from '@mui/material'
import {
  Notifications as NotificationsIcon,
  Circle as CircleIcon,
  DoneAll as DoneAllIcon,
} from '@mui/icons-material'
import { useNotificaciones } from '../../hooks/useNotificaciones'
import { useAuth } from '../../contexts/AuthContext'
import { parseISO, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Etiqueta y color por módulo de origen (debe coincidir con config/notificaciones.php)
const MODULO_INFO: Record<string, { label: string; color: string }> = {
  cero_papel: { label: 'Cero Papel', color: '#0071BC' },
  correspondencia: { label: 'Correspondencia', color: '#28A9E3' },
  oirs: { label: 'OIRS', color: '#EB1B78' },
}

const NotificacionesBell = () => {
  const { user } = useAuth()
  const {
    notificaciones,
    contadorNoLeidas,
    marcarLeida,
    marcarTodasLeidas,
  } = useNotificaciones(!!user)
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const open = Boolean(anchorEl)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleNotifClick = async (notif: { id: number; data?: Record<string, unknown> }) => {
    await marcarLeida(notif.id)
    const url = notif.data?.url
    // Solo navegación interna (evita open-redirect si la url no es una ruta relativa)
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
      handleClose()
      navigate(url)
    }
  }

  return (
    <>
      <IconButton color="inherit" onClick={handleClick}>
        <Badge badgeContent={contadorNoLeidas} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: { sx: { width: 360, maxHeight: 420 } },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Notificaciones
          </Typography>
          {contadorNoLeidas > 0 && (
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={marcarTodasLeidas}
            >
              Marcar todas
            </Button>
          )}
        </Box>
        <Divider />

        {notificaciones.length > 0 ? (
          <List disablePadding dense sx={{ maxHeight: 300, overflow: 'auto' }}>
            {notificaciones.slice(0, 10).map((notif, i) => (
              <ListItem
                key={notif.id}
                divider={i < Math.min(notificaciones.length, 10) - 1}
                sx={{
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => handleNotifClick(notif)}
              >
                <ListItemIcon sx={{ minWidth: 24, alignSelf: 'flex-start', mt: 0.5 }}>
                  <CircleIcon sx={{ fontSize: 8, color: 'primary.main' }} />
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
                      <Typography variant="body2" fontWeight="medium" sx={{ lineHeight: 1.3 }}>
                        {notif.titulo}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.3,
                          mt: 0.25,
                        }}
                      >
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
            ))}
          </List>
        ) : (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Sin notificaciones nuevas
            </Typography>
          </Box>
        )}

        <Divider />
        <Box sx={{ px: 2, py: 1, textAlign: 'center' }}>
          <Button
            fullWidth
            size="small"
            onClick={() => {
              handleClose()
              navigate('/notificaciones')
            }}
          >
            Ver todas las notificaciones
          </Button>
        </Box>
      </Popover>
    </>
  )
}

export default NotificacionesBell
