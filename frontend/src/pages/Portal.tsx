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
  Divider,
  Button,
} from '@mui/material'
import {
  Mail as MailIcon,
  Description as DocumentIcon,
  Forum as OirsIcon,
  Settings as AdminIcon,
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'

const Portal = () => {
  const navigate = useNavigate()
  const { user, selectedRole, hasAplicacion, isAdmin } = useAuth()

  const getRolTexto = () => {
    if (!selectedRole) return 'Usuario'
    switch (selectedRole) {
      case 'admin':
        return 'Administrador'
      case 'oficial':
        return 'Oficial de Partes'
      case 'oirs':
        return 'Administrador OIRS'
      case 'usuario':
        return 'Usuario'
      default:
        return 'Usuario'
    }
  }

  const getCorrespondenciaRoute = () => {
    if (selectedRole === 'usuario') {
      return '/bandeja'
    }
    return '/correspondencia'
  }

  const aplicaciones = [
    {
      id: 'correspondencia',
      nombre: 'Sistema de Correspondencia',
      descripcion: 'Gestión de correspondencia entrada y salida, derivaciones y seguimiento',
      icono: <MailIcon sx={{ fontSize: 40 }} />,
      color: '#4299e1',
      ruta: getCorrespondenciaRoute(),
      activa: true,
    },
    {
      id: 'oirs',
      nombre:
        selectedRole === 'admin' || selectedRole === 'oirs'
          ? 'Administración OIRS'
          : 'Mis Solicitudes OIRS',
      descripcion:
        selectedRole === 'admin' || selectedRole === 'oirs'
          ? 'Gestión de solicitudes, reclamos y sugerencias ciudadanas'
          : 'Solicitudes asignadas para tu respuesta',
      icono: <OirsIcon sx={{ fontSize: 40 }} />,
      color: '#ed8936',
      ruta: selectedRole === 'admin' || selectedRole === 'oirs' ? '/oirs-admin' : '/mis-solicitudes',
      activa: true,
    },
    {
      id: 'gestor_documental',
      nombre: 'Cero Papel Cabo de Hornos',
      descripcion: 'Repositorio digital y gestión de documentos sin papel',
      icono: <DocumentIcon sx={{ fontSize: 40 }} />,
      color: '#48bb78',
      ruta: '/gestor-documental',
      activa: true,
    },
  ]

  const aplicacionesAdmin = [
    {
      id: 'administracion',
      nombre: 'Administración',
      descripcion: 'Gestión de usuarios, departamentos y configuración del sistema',
      icono: <AdminIcon sx={{ fontSize: 40 }} />,
      color: '#667eea',
      ruta: '/administracion',
      activa: true,
    },
  ]

  const todasLasAplicaciones = [...aplicaciones, ...(isAdmin() ? aplicacionesAdmin : [])]

  const aplicacionesDisponibles = todasLasAplicaciones.filter((app) => {
    if (app.id === 'administracion') return isAdmin()
    return hasAplicacion(app.id)
  })

  const handleAppClick = (app: typeof aplicaciones[0]) => {
    if (!app.activa) return
    navigate(app.ruta)
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 6,
          mb: 4,
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box>
                <Typography variant="h3" component="h1" fontWeight="bold">
                  Portal de Funcionarios
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9 }}>
                  Ilustre Municipalidad de Cabo de Hornos
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/')}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  '&:hover': {
                    borderColor: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                Portal Ciudadano
              </Button>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                  {user?.nombre || 'Usuario'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {getRolTexto()}
                </Typography>
              </Box>
              <Avatar
                sx={{
                  width: 50,
                  height: 50,
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                }}
              >
                {user?.nombre?.charAt(0) || 'U'}
              </Avatar>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Contenido principal */}
      <Container maxWidth="xl" sx={{ pb: 8 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          Selecciona una aplicación
        </Typography>

        <Grid container spacing={3}>
          {aplicacionesDisponibles.map((app) => (
            <Grid item xs={12} sm={6} md={3} key={app.id}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                  border: app.activa ? '2px solid' : '2px dashed',
                  borderColor: app.activa ? app.color : 'grey.300',
                  opacity: app.activa ? 1 : 0.6,
                }}
              >
                <CardActionArea
                  onClick={() => handleAppClick(app)}
                  disabled={!app.activa}
                  sx={{ height: '100%' }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 4 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 2,
                        bgcolor: `${app.color}20`,
                        mb: 2,
                      }}
                    >
                      <Box sx={{ color: app.color }}>{app.icono}</Box>
                    </Box>
                    <Typography variant="h6" gutterBottom fontWeight="bold">
                      {app.nombre}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {app.descripcion}
                    </Typography>
                    {!app.activa && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'warning.main',
                          fontWeight: 'medium',
                          display: 'block',
                          mt: 1,
                        }}
                      >
                        Próximamente
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>

        {aplicacionesDisponibles.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="textSecondary">
              No tienes aplicaciones asignadas
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 6 }} />

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            {selectedRole === 'admin' || selectedRole === 'oficial'
              ? 'Sistema de gestión municipal - Módulos administrativos'
              : 'Sistema de gestión municipal - Módulo de correspondencia'}
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 1 }} color="textSecondary">
            Versión 1.0 - Ilustre Municipalidad de Cabo de Hornos
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

export default Portal
