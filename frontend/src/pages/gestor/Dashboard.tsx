import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Button,
} from '@mui/material'
import {
  Folder as ExpedienteIcon,
  Description as DocumentoIcon,
  PendingActions as PendienteIcon,
  Archive as ArchiveIcon,
  Inbox as RecibidosIcon,
  Add as AddIcon,
  FolderCopy as RepoExpedientesIcon,
} from '@mui/icons-material'

const GestorDashboard = () => {
  const navigate = useNavigate()

  const modulos = [
    {
      titulo: 'Mis Expedientes',
      descripcion: 'Expedientes creados por ti',
      icono: <ExpedienteIcon sx={{ fontSize: 48 }} />,
      color: '#4299e1',
      ruta: '/expedientes',
    },
    {
      titulo: 'Mis Documentos',
      descripcion: 'Documentos creados por ti',
      icono: <DocumentoIcon sx={{ fontSize: 48 }} />,
      color: '#48bb78',
      ruta: '/documentos',
    },
    {
      titulo: 'Pendientes de Firma',
      descripcion: 'Documentos que requieren tu firma',
      icono: <PendienteIcon sx={{ fontSize: 48 }} />,
      color: '#ed8936',
      ruta: '/pendientes-firma',
    },
    {
      titulo: 'Documentos Recibidos',
      descripcion: 'Documentos enviados a tu bandeja',
      icono: <RecibidosIcon sx={{ fontSize: 48 }} />,
      color: '#38b2ac',
      ruta: '/documentos-recibidos',
    },
    {
      titulo: 'Repositorio de Expedientes',
      descripcion: 'Expedientes cerrados de todos los usuarios',
      icono: <RepoExpedientesIcon sx={{ fontSize: 48 }} />,
      color: '#e53e3e',
      ruta: '/repositorio-expedientes',
    },
    {
      titulo: 'Repositorio Documental',
      descripcion: 'Archivo de documentos firmados',
      icono: <ArchiveIcon sx={{ fontSize: 48 }} />,
      color: '#9f7aea',
      ruta: '/repositorio-documental',
    },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Cero Papel Cabo de Hornos
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gestor Documental - Municipalidad de Cabo de Hornos
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/expedientes/nuevo')}
          >
            Nuevo Expediente
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/documentos/nuevo')}
          >
            Nuevo Documento
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {modulos.map((modulo) => (
          <Grid item xs={12} sm={6} md={3} key={modulo.titulo}>
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
                onClick={() => navigate(modulo.ruta)}
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
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Accesos rápidos */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h6" gutterBottom>
          Accesos Rápidos
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="medium">
                  Crear Decreto
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Decreto alcaldicio con firma electrónica
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate('/documentos/nuevo?tipo=DEC')}
                >
                  Crear
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="medium">
                  Crear Resolución
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Resolución exenta con correlativo automático
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate('/documentos/nuevo?tipo=RES')}
                >
                  Crear
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="medium">
                  Crear Oficio
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Oficio ordinario para comunicación externa
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate('/documentos/nuevo?tipo=OFI')}
                >
                  Crear
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}

export default GestorDashboard
