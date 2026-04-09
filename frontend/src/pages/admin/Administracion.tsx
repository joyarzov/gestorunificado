import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
} from '@mui/material'
import {
  People as UsersIcon,
  Business as DeptosIcon,
  Settings as ConfigIcon,
  Archive as ArchiveIcon,
  Verified as SelloIcon,
} from '@mui/icons-material'

const Administracion = () => {
  const navigate = useNavigate()

  const modulos = [
    {
      titulo: 'Usuarios',
      descripcion: 'Gestión de usuarios del sistema',
      icono: <UsersIcon sx={{ fontSize: 48 }} />,
      color: '#28A9E3',
      ruta: '/usuarios',
    },
    {
      titulo: 'Departamentos',
      descripcion: 'Administrar departamentos y unidades',
      icono: <DeptosIcon sx={{ fontSize: 48 }} />,
      color: '#8AC53E',
      ruta: '/departamentos',
    },
    {
      titulo: 'Configuración',
      descripcion: 'Configuración general del sistema',
      icono: <ConfigIcon sx={{ fontSize: 48 }} />,
      color: '#EE5825',
      ruta: '#',
      disabled: true,
    },
    {
      titulo: 'Repositorio Documental',
      descripcion: 'Archivo de documentos firmados',
      icono: <ArchiveIcon sx={{ fontSize: 48 }} />,
      color: '#0071BC',
      ruta: '/repositorio-documental',
    },
    {
      titulo: 'Sello de Firma',
      descripcion: 'Diseño del sello en documentos firmados electrónicamente',
      icono: <SelloIcon sx={{ fontSize: 48 }} />,
      color: '#EB1B78',
      ruta: '/firma-sellos',
    },
  ]

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Administración del Sistema
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Gestión de usuarios, departamentos y configuración
      </Typography>

      <Grid container spacing={3}>
        {modulos.map((modulo) => (
          <Grid item xs={12} sm={6} md={3} key={modulo.titulo}>
            <Card
              sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                opacity: modulo.disabled ? 0.6 : 1,
                '&:hover': {
                  transform: modulo.disabled ? 'none' : 'translateY(-4px)',
                  boxShadow: modulo.disabled ? 1 : 4,
                },
              }}
            >
              <CardActionArea
                onClick={() => !modulo.disabled && navigate(modulo.ruta)}
                disabled={modulo.disabled}
                sx={{ height: '100%' }}
              >
                <CardContent sx={{ textAlign: 'center', p: 4 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: 2,
                      bgcolor: `${modulo.color}20`,
                      mb: 2,
                      color: modulo.color,
                    }}
                  >
                    {modulo.icono}
                  </Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {modulo.titulo}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {modulo.descripcion}
                  </Typography>
                  {modulo.disabled && (
                    <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                      Próximamente
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

export default Administracion
