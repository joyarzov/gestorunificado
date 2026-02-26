import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardActionArea,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Alert,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material'
import {
  Mail as MailIcon,
  Description as DocumentIcon,
  Forum as OirsIcon,
  Settings as AdminIcon,
  Refresh as RefreshIcon,
  Notifications as NotificacionesIcon,
  DoneAll as DoneAllIcon,
  Circle as CircleIcon,
  AccessTime as TimeIcon,
  ExitToApp as LogoutIcon,
  SwapHoriz as SwapRoleIcon,
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'
import { notificacionesAPI } from '../api/common'
import { Notificacion } from '../types'
import { parseISO, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useHoraOficial } from '../hooks/useHoraOficial'

const Portal = () => {
  const navigate = useNavigate()
  const { user, selectedRole, hasAplicacion, isAdmin, logout, setShowRoleSelector } = useAuth()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const notifRes = await notificacionesAPI.noLeidas().catch(() => ({ success: false, data: [] as Notificacion[], message: '' }))
      if (notifRes.success) setNotificaciones(notifRes.data)
    } catch {
      setError('Error al cargar las notificaciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleCambiarPerfil = () => {
    setShowRoleSelector(true)
  }

  const { hora, fecha } = useHoraOficial()
  const tieneMultiplesRoles = (user?.roles?.length ?? 0) > 1

  const handleMarcarTodasLeidas = async () => {
    try {
      await notificacionesAPI.marcarTodasLeidas()
      setNotificaciones([])
    } catch { /* ignore */ }
  }

  const getRolTexto = () => {
    switch (selectedRole) {
      case 'admin': return 'Administrador'
      case 'oficial': return 'Oficial de Partes'
      case 'oirs': return 'Administrador OIRS'
      case 'alcalde': return 'Alcalde'
      default: return 'Usuario'
    }
  }

  const getCorrespondenciaRoute = () => {
    if (selectedRole === 'usuario' || selectedRole === 'alcalde') return '/bandeja'
    return '/correspondencia'
  }

  const getOirsRoute = () => {
    if (selectedRole === 'admin' || selectedRole === 'oirs') return '/oirs-admin'
    return '/mis-solicitudes'
  }

  // Módulos disponibles
  const modulos = [
    {
      id: 'correspondencia',
      nombre: selectedRole === 'admin' || selectedRole === 'oficial' ? 'Oficina de Partes' : 'Correspondencia',
      descripcion: selectedRole === 'admin' || selectedRole === 'oficial'
        ? 'Recepción, derivación y seguimiento de correspondencia'
        : 'Gestión de correspondencia, derivaciones y seguimiento',
      icono: <MailIcon sx={{ fontSize: 40 }} />,
      color: '#28A9E3',
      ruta: getCorrespondenciaRoute(),
      visible: hasAplicacion('correspondencia'),
    },
    {
      id: 'oirs',
      nombre: selectedRole === 'admin' || selectedRole === 'oirs' ? 'Administración OIRS' : 'Mis Solicitudes OIRS',
      descripcion: selectedRole === 'admin' || selectedRole === 'oirs'
        ? 'Gestión de solicitudes ciudadanas'
        : 'Solicitudes asignadas para tu respuesta',
      icono: <OirsIcon sx={{ fontSize: 40 }} />,
      color: '#EE5825',
      ruta: getOirsRoute(),
      visible: hasAplicacion('oirs'),
    },
    {
      id: 'gestor_documental',
      nombre: 'Cero Papel',
      descripcion: 'Documentos, expedientes y firma electrónica',
      icono: <DocumentIcon sx={{ fontSize: 40 }} />,
      color: '#8AC53E',
      ruta: '/gestor-documental',
      visible: hasAplicacion('gestor_documental'),
    },
    {
      id: 'administracion',
      nombre: 'Administración',
      descripcion: 'Usuarios, departamentos y configuración',
      icono: <AdminIcon sx={{ fontSize: 40 }} />,
      color: '#0071BC',
      ruta: '/administracion',
      visible: isAdmin(),
    },
  ].filter(m => m.visible)

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          bgcolor: '#0071BC',
          color: 'white',
          py: 4,
          mb: 3,
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <Box
                component="img"
                src="/logo.png"
                alt="Municipalidad de Cabo de Hornos"
                sx={{ height: 52, width: 'auto', bgcolor: 'white', borderRadius: 1.5, p: 0.5 }}
              />
              <Box>
                <Typography variant="h4" component="h1" fontWeight="bold">
                  Hola, {user?.nombre?.split(' ')[0] || 'Usuario'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {getRolTexto()} {user?.departamento?.nombre ? ` \u00B7 ${user.departamento.nombre}` : ''}
                  {fecha ? ` \u00B7 ${fecha}` : ''}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Hora Oficial de Chile - SHOA NTP */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 2,
                  px: 2,
                  py: 0.75,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <TimeIcon sx={{ fontSize: 20, opacity: 0.9 }} />
                <Box sx={{ textAlign: 'right' }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                    sx={{ lineHeight: 1.2, fontFamily: 'monospace', letterSpacing: 1 }}
                  >
                    {hora || '--:--:--'}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.75, lineHeight: 1, display: 'block', fontSize: '0.65rem' }}>
                    Hora Oficial (Magallanes UTC-3)
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Tooltip title="Actualizar">
                <IconButton onClick={fetchData} sx={{ color: 'white' }}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/')}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' },
                }}
              >
                Portal Ciudadano
              </Button>
              {tieneMultiplesRoles && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SwapRoleIcon />}
                  onClick={handleCambiarPerfil}
                  sx={{
                    color: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    '&:hover': { borderColor: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' },
                  }}
                >
                  Cambiar Perfil
                </Button>
              )}
              <Button
                variant="outlined"
                size="small"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  '&:hover': { borderColor: '#ff8a80', bgcolor: 'rgba(255, 255, 255, 0.1)' },
                }}
              >
                Cerrar Sesión
              </Button>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ pb: 6 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} action={
            <Button color="inherit" size="small" onClick={fetchData}>Reintentar</Button>
          }>
            {error}
          </Alert>
        )}

        {/* === SECCIÓN 1: MÓDULOS === */}
        <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>
          Aplicaciones
        </Typography>
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {modulos.map((mod) => (
            <Grid item xs={12} sm={6} md={3} key={mod.id}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                  borderTop: `4px solid ${mod.color}`,
                }}
                elevation={2}
              >
                <CardActionArea
                  onClick={() => navigate(mod.ruta)}
                  sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      bgcolor: `${mod.color}12`,
                      color: mod.color,
                      mb: 1.5,
                    }}
                  >
                    {mod.icono}
                  </Box>
                  <Typography variant="subtitle1" fontWeight="bold" textAlign="center">
                    {mod.nombre}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 0.5 }}>
                    {mod.descripcion}
                  </Typography>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
          {modulos.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">No tienes aplicaciones asignadas</Typography>
              </Paper>
            </Grid>
          )}
        </Grid>

        {/* === SECCIÓN 2: NOTIFICACIONES === */}
        <Paper sx={{ p: 0, overflow: 'hidden' }} elevation={2}>
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Badge badgeContent={notificaciones.length} color="error" max={99}>
                <NotificacionesIcon fontSize="small" color="action" />
              </Badge>
              <Typography variant="subtitle1" fontWeight="bold">
                Notificaciones
              </Typography>
            </Box>
            {notificaciones.length > 0 && (
              <Tooltip title="Marcar todas como leídas">
                <IconButton size="small" onClick={handleMarcarTodasLeidas}>
                  <DoneAllIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {loading ? (
            <Box sx={{ p: 2 }}>
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={36} sx={{ mb: 0.5 }} />)}
            </Box>
          ) : notificaciones.length > 0 ? (
            <List disablePadding dense sx={{ maxHeight: 280, overflow: 'auto' }}>
              {notificaciones.slice(0, 8).map((notif, i) => (
                <ListItem
                  key={notif.id}
                  divider={i < Math.min(notificaciones.length, 8) - 1}
                  sx={{
                    px: 2,
                    py: 0.75,
                    ...(notif.data?.url ? {
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    } : {}),
                  }}
                  onClick={async () => {
                    if (notif.data?.url) {
                      try { await notificacionesAPI.marcarLeida(notif.id) } catch { /* ignore */ }
                      setNotificaciones(prev => prev.filter(n => n.id !== notif.id))
                      navigate(notif.data.url as string)
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <CircleIcon sx={{ fontSize: 8, color: 'primary.main' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                        <Typography variant="body2" fontWeight="medium" noWrap sx={{ flex: 1 }}>
                          {notif.titulo}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                          {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true, locale: es })}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {notif.mensaje}
                      </Typography>
                    }
                    sx={{ my: 0 }}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Sin notificaciones nuevas
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 5 }}>
          <Typography variant="body2" color="text.secondary">
            Ilustre Municipalidad de Cabo de Hornos
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 0.5 }} color="text.disabled">
            Sistema de Gestión Municipal v1.0
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

export default Portal
