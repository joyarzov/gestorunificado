import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Button,
} from '@mui/material'
import {
  Forum as OirsIcon,
  Search as SearchIcon,
  Login as LoginIcon,
  VerifiedUser as VerifyIcon,
} from '@mui/icons-material'

const PublicHome = () => {
  const navigate = useNavigate()

  const serviciosPublicos = [
    {
      titulo: 'OIRS',
      descripcion: 'Ingrese consultas, reclamos, sugerencias o solicitudes de información',
      icono: <OirsIcon sx={{ fontSize: 48 }} />,
      color: '#ed8936',
      ruta: '/oirs',
    },
    {
      titulo: 'Consultar Solicitud',
      descripcion: 'Revise el estado de su solicitud OIRS con su número de folio',
      icono: <SearchIcon sx={{ fontSize: 48 }} />,
      color: '#4299e1',
      ruta: '/oirs/consultar',
    },
    {
      titulo: 'Verificar Documento',
      descripcion: 'Verifique la autenticidad de un documento municipal con su código de verificación',
      icono: <VerifyIcon sx={{ fontSize: 48 }} />,
      color: '#38a169',
      ruta: '/verificar',
    },
  ]

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: 8,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h3" fontWeight="bold" gutterBottom>
                Portal Ciudadano
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                Ilustre Municipalidad de Cabo de Hornos
              </Typography>
              <Typography variant="body1" sx={{ mt: 2, opacity: 0.8 }}>
                Bienvenido al portal de servicios en línea de la municipalidad.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<LoginIcon />}
              onClick={() => navigate('/login')}
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
              }}
            >
              Funcionarios
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Servicios */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 4 }}>
          Servicios Disponibles
        </Typography>

        <Grid container spacing={4}>
          {serviciosPublicos.map((servicio) => (
            <Grid item xs={12} sm={6} md={4} key={servicio.titulo}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardActionArea
                  onClick={() => navigate(servicio.ruta)}
                  sx={{ height: '100%' }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 4 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        p: 2,
                        borderRadius: 2,
                        bgcolor: `${servicio.color}20`,
                        mb: 2,
                        color: servicio.color,
                      }}
                    >
                      {servicio.icono}
                    </Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      {servicio.titulo}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {servicio.descripcion}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Información de contacto */}
        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Información de Contacto
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Dirección: Plaza de Armas s/n, Puerto Williams
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Teléfono: +56 61 262 1011
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Horario: Lunes a Viernes, 08:30 - 17:30 hrs
          </Typography>
        </Box>
      </Container>

      {/* Footer */}
      <Box sx={{ bgcolor: 'grey.100', py: 4, mt: 'auto' }}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" textAlign="center">
            © {new Date().getFullYear()} Ilustre Municipalidad de Cabo de Hornos. Todos los derechos reservados.
          </Typography>
        </Container>
      </Box>
    </Box>
  )
}

export default PublicHome
