import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardActionArea,
  Button,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  Mail as MailIcon,
  Description as DocumentIcon,
  Forum as OirsIcon,
  Settings as AdminIcon,
  Storefront as FomentoIcon,
  Refresh as RefreshIcon,
  AccessTime as TimeIcon,
  ExitToApp as LogoutIcon,
  SwapHoriz as SwapRoleIcon,
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'
import { useHoraOficial } from '../hooks/useHoraOficial'
import NotificacionesBell from '../components/layout/NotificacionesBell'

const Portal = () => {
  const navigate = useNavigate()
  const { user, selectedRole, hasAplicacion, isAdmin, logout, setShowRoleSelector } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleCambiarPerfil = () => {
    setShowRoleSelector(true)
  }

  const { hora, fecha } = useHoraOficial()
  const tieneMultiplesRoles = (user?.roles?.length ?? 0) > 1

  const getRolTexto = () => {
    switch (selectedRole) {
      case 'admin': return 'Administrador'
      case 'oficial': return 'Oficial de Partes'
      case 'oirs': return 'Administrador OIRS'
      case 'alcalde': return 'Alcalde'
      case 'fomento_productivo': return 'Fomento Productivo'
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
      id: 'fomento_productivo',
      nombre: 'Fomento Productivo',
      descripcion: 'Gestión de fondos concursables y postulaciones',
      icono: <FomentoIcon sx={{ fontSize: 40 }} />,
      color: '#EB1B78',
      ruta: '/fomento-productivo',
      visible: hasAplicacion('fomento_productivo'),
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
                src="/logo_blanco.png"
                alt="Municipalidad de Cabo de Hornos"
                sx={{ height: 52, width: 'auto' }}
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
              <NotificacionesBell />
              <Tooltip title="Actualizar">
                <IconButton sx={{ color: 'white' }}>
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
