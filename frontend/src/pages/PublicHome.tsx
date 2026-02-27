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
  Button,
} from '@mui/material'
import {
  Forum as OirsIcon,
  Search as SearchIcon,
  Login as LoginIcon,
  VerifiedUser as VerifyIcon,
  Storefront as NegocioIcon,
  TrackChanges as SeguimientoIcon,
} from '@mui/icons-material'
import { FondoConcursable } from '../types'
import { fondosPublicoAPI } from '../api/fondos'
import FondoInfoDialog from '../components/fondos/FondoInfoDialog'

const PublicHome = () => {
  const navigate = useNavigate()
  const [fondoActivo, setFondoActivo] = useState<FondoConcursable | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fondosPublicoAPI.obtenerActivo()
      .then((res) => setFondoActivo(res.data))
      .catch(() => { /* No hay fondo activo */ })
  }, [])

  const serviciosPublicos = [
    {
      titulo: 'OIRS',
      descripcion: 'Ingrese consultas, reclamos, sugerencias o solicitudes de información',
      icono: <OirsIcon sx={{ fontSize: 48 }} />,
      color: '#EE5825',
      ruta: '/oirs',
    },
    {
      titulo: 'Consultar Solicitud',
      descripcion: 'Revise el estado de su solicitud OIRS con su número de folio',
      icono: <SearchIcon sx={{ fontSize: 48 }} />,
      color: '#28A9E3',
      ruta: '/oirs/consultar',
    },
    {
      titulo: 'Verificar Documento',
      descripcion: 'Verifique la autenticidad de un documento municipal con su código de verificación',
      icono: <VerifyIcon sx={{ fontSize: 48 }} />,
      color: '#2DC700',
      ruta: '/verificar',
    },
  ]

  const fondoServicios = [
    ...(fondoActivo ? [{
      titulo: 'Tu Negocio Crece',
      descripcion: 'Postula al fondo concursable para emprendedores de Cabo de Hornos',
      icono: <NegocioIcon sx={{ fontSize: 48 }} />,
      color: '#EB1B78',
      accion: () => setDialogOpen(true),
    }] : []),
    {
      titulo: 'Seguimiento Postulación',
      descripcion: 'Consulte el estado de su postulación al fondo concursable',
      icono: <SeguimientoIcon sx={{ fontSize: 48 }} />,
      color: '#8AC53E',
      ruta: '/fondos/seguimiento',
    },
  ]

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: '#0071BC',
          color: 'white',
          py: 4,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box
                component="img"
                src="/logo.png"
                alt="Ilustre Municipalidad de Cabo de Hornos"
                sx={{ height: 64, width: 'auto', flexShrink: 0 }}
              />
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  Portal Ciudadano
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.85 }}>
                  Ilustre Municipalidad de Cabo de Hornos
                </Typography>
              </Box>
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

        {/* Fondos Concursables */}
        {fondoServicios.length > 0 && (
          <>
            <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 4, mt: 6 }}>
              Fondos Concursables
            </Typography>

            <Grid container spacing={4}>
              {fondoServicios.map((servicio) => (
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
                      onClick={() => 'accion' in servicio && servicio.accion ? servicio.accion() : navigate(servicio.ruta!)}
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
          </>
        )}

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

      {/* Dialog Fondo Concursable */}
      <FondoInfoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fondo={fondoActivo}
      />
    </Box>
  )
}

export default PublicHome
