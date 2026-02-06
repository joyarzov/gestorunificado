import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Skeleton,
  Alert,
  IconButton,
  Tooltip,
  Badge,
  Divider,
} from '@mui/material'
import {
  Mail as MailIcon,
  Description as DocumentIcon,
  Forum as OirsIcon,
  Settings as AdminIcon,
  Draw as FirmaIcon,
  Inbox as BandejaIcon,
  Assignment as SolicitudIcon,
  ArrowForward as ArrowIcon,
  Refresh as RefreshIcon,
  Notifications as NotificacionesIcon,
  DoneAll as DoneAllIcon,
  Circle as CircleIcon,
  AccessTime as TimeIcon,
  Warning as WarningIcon,
  ExitToApp as LogoutIcon,
  SwapHoriz as SwapRoleIcon,
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'
import { dashboardAPI, DashboardData } from '../api/dashboard'
import { notificacionesAPI } from '../api/common'
import { Notificacion } from '../types'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const Portal = () => {
  const navigate = useNavigate()
  const { user, selectedRole, hasAplicacion, isAdmin, logout, setShowRoleSelector } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [dashRes, notifRes] = await Promise.all([
        dashboardAPI.resumen(),
        notificacionesAPI.noLeidas().catch(() => ({ success: false, data: [] as Notificacion[], message: '' })),
      ])
      if (dashRes.success) setData(dashRes.data)
      if (notifRes.success) setNotificaciones(notifRes.data)
    } catch {
      setError('Error al cargar el dashboard')
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
      nombre: 'Correspondencia',
      descripcion: 'Gestión de correspondencia, derivaciones y seguimiento',
      icono: <MailIcon sx={{ fontSize: 40 }} />,
      color: '#4299e1',
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
      color: '#ed8936',
      ruta: getOirsRoute(),
      visible: hasAplicacion('oirs'),
    },
    {
      id: 'gestor_documental',
      nombre: 'Cero Papel',
      descripcion: 'Documentos, expedientes y firma electrónica',
      icono: <DocumentIcon sx={{ fontSize: 40 }} />,
      color: '#48bb78',
      ruta: '/gestor-documental',
      visible: hasAplicacion('gestor_documental'),
    },
    {
      id: 'administracion',
      nombre: 'Administración',
      descripcion: 'Usuarios, departamentos y configuración',
      icono: <AdminIcon sx={{ fontSize: 40 }} />,
      color: '#667eea',
      ruta: '/administracion',
      visible: isAdmin(),
    },
  ].filter(m => m.visible)

  // Items pendientes del usuario
  const getPendientes = () => {
    if (!data) return []
    const items: Array<{ texto: string; cantidad: number; color: string; icono: React.ReactNode; ruta: string; urgente?: boolean }> = []

    if (data.correspondencia.pendientes_bandeja > 0) {
      items.push({
        texto: 'Correspondencias en tu bandeja',
        cantidad: data.correspondencia.pendientes_bandeja,
        color: '#4299e1',
        icono: <BandejaIcon />,
        ruta: '/bandeja',
      })
    }
    if (data.gestor.mis_pendientes_firma > 0) {
      items.push({
        texto: 'Documentos pendientes de tu firma',
        cantidad: data.gestor.mis_pendientes_firma,
        color: '#e53e3e',
        icono: <FirmaIcon />,
        ruta: '/pendientes-firma',
        urgente: true,
      })
    }
    if (data.oirs.mis_asignadas > 0) {
      items.push({
        texto: 'Solicitudes OIRS asignadas',
        cantidad: data.oirs.mis_asignadas,
        color: '#ed8936',
        icono: <SolicitudIcon />,
        ruta: getOirsRoute(),
      })
    }
    if (data.oirs.proximas_vencer > 0) {
      items.push({
        texto: 'OIRS por vencer (próximos 3 días)',
        cantidad: data.oirs.proximas_vencer,
        color: '#e53e3e',
        icono: <WarningIcon />,
        ruta: getOirsRoute(),
        urgente: true,
      })
    }
    return items
  }

  const pendientes = getPendientes()
  const totalPendientes = pendientes.reduce((acc, p) => acc + p.cantidad, 0)

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 4,
          mb: 3,
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  border: '2px solid rgba(255, 255, 255, 0.4)',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                }}
              >
                {user?.nombre?.charAt(0) || 'U'}
              </Avatar>
              <Box>
                <Typography variant="h4" component="h1" fontWeight="bold">
                  Hola, {user?.nombre?.split(' ')[0] || 'Usuario'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {getRolTexto()} {user?.departamento?.nombre ? ` \u00B7 ${user.departamento.nombre}` : ''} {' \u00B7 '}
                  {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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

        {/* === SECCIÓN 2: PENDIENTES + NOTIFICACIONES lado a lado === */}
        <Grid container spacing={3}>
          {/* Panel de Pendientes */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 0, overflow: 'hidden' }} elevation={2}>
              <Box sx={{ px: 3, py: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" fontWeight="bold">
                    Tareas Pendientes
                  </Typography>
                  {!loading && totalPendientes > 0 && (
                    <Chip label={totalPendientes} size="small" color="error" />
                  )}
                </Box>
              </Box>

              {loading ? (
                <Box sx={{ p: 3 }}>
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={56} sx={{ mb: 1 }} />)}
                </Box>
              ) : pendientes.length > 0 ? (
                <List disablePadding>
                  {pendientes.map((item, i) => (
                    <ListItem
                      key={i}
                      divider={i < pendientes.length - 1}
                      sx={{
                        px: 3,
                        py: 1.5,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => navigate(item.ruta)}
                    >
                      <ListItemIcon sx={{ minWidth: 44, color: item.color }}>
                        {item.icono}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">
                              {item.texto}
                            </Typography>
                            {item.urgente && (
                              <Chip label="Urgente" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={item.cantidad}
                            size="small"
                            sx={{
                              bgcolor: `${item.color}18`,
                              color: item.color,
                              fontWeight: 'bold',
                              fontSize: '0.85rem',
                              minWidth: 32,
                            }}
                          />
                          <IconButton size="small" onClick={() => navigate(item.ruta)}>
                            <ArrowIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <DoneAllIcon sx={{ fontSize: 48, color: 'success.light', mb: 1 }} />
                  <Typography color="text.secondary">
                    No tienes tareas pendientes
                  </Typography>
                </Box>
              )}

              {/* Resumen rápido de documentos */}
              {!loading && data && (
                <>
                  <Divider />
                  <Box sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Resumen de documentos
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight="bold" color="#a0aec0">
                            {data.gestor.documentos_borrador}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Borradores</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight="bold" color="#ed8936">
                            {data.gestor.documentos_pendiente_firma}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Pend. Firma</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight="bold" color="#48bb78">
                            {data.gestor.documentos_firmados}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Firmados</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  <Divider />
                  <Box sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Correspondencia
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight="bold" color="text.primary">
                            {data.correspondencia.total}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Total</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight="bold" color="#ed8936">
                            {data.correspondencia.pendientes}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Pendientes</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight="bold" color="#4299e1">
                            {data.correspondencia.en_proceso}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">En proceso</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight="bold" color="#48bb78">
                            {data.correspondencia.completadas}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Completadas</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                </>
              )}
            </Paper>
          </Grid>

          {/* Panel de Notificaciones */}
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 0, overflow: 'hidden' }} elevation={2}>
              <Box sx={{ px: 3, py: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Badge badgeContent={notificaciones.length} color="error" max={99}>
                    <NotificacionesIcon color="action" />
                  </Badge>
                  <Typography variant="h6" fontWeight="bold">
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
                <Box sx={{ p: 3 }}>
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={52} sx={{ mb: 1 }} />)}
                </Box>
              ) : notificaciones.length > 0 ? (
                <List disablePadding sx={{ maxHeight: 420, overflow: 'auto' }}>
                  {notificaciones.slice(0, 10).map((notif, i) => (
                    <ListItem
                      key={notif.id}
                      divider={i < Math.min(notificaciones.length, 10) - 1}
                      sx={{ px: 3, py: 1.5, alignItems: 'flex-start' }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                        <CircleIcon sx={{ fontSize: 10, color: 'primary.main' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight="medium">
                            {notif.titulo}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {notif.mensaje}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <TimeIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                              <Typography variant="caption" color="text.disabled">
                                {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true, locale: es })}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <NotificacionesIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />
                  <Typography color="text.secondary">
                    Sin notificaciones nuevas
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

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
