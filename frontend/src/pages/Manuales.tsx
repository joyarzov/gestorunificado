import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Button, Grid,
} from '@mui/material'
import {
  MenuBook as ManualIcon,
  Download as DownloadIcon,
  Badge as OficialIcon,
  AccountBalance as AlcaldeIcon,
  People as FuncionariosIcon,
} from '@mui/icons-material'
import CorporateColorBar from '../components/branding/CorporateColorBar'

const MANUALES = [
  {
    archivo: '/manuales/manual-oficina-de-partes.pdf',
    rol: 'Oficina de Partes',
    icono: <OficialIcon sx={{ fontSize: 42 }} color="primary" />,
    descripcion: 'Ingreso de correspondencia, derivación a Alcaldía, salidas (reserva, despacho, devoluciones), libro de correspondencia firmado y supervisión.',
  },
  {
    archivo: '/manuales/manual-alcalde.pdf',
    rol: 'Alcalde y Subrogante',
    icono: <AlcaldeIcon sx={{ fontSize: 42 }} color="primary" />,
    descripcion: 'Bandeja del despacho, acuse con providencia firmada (OTP), derivación a funcionarios, preparar respuestas, cierre del proceso y subrogancia.',
  },
  {
    archivo: '/manuales/manual-funcionarios.pdf',
    rol: 'Funcionarios Municipales',
    icono: <FuncionariosIcon sx={{ fontSize: 42 }} color="primary" />,
    descripcion: 'Acceso y contraseñas, notificaciones, acuse de recibo, detalle de la correspondencia y conversación con archivos adjuntos.',
  },
]

const Manuales = () => {
  const navigate = useNavigate()
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#0071BC',
        p: 2,
        gap: 3,
      }}
    >
      <Box component="img" src="/logo_blanco.png" alt="Municipalidad de Cabo de Hornos" sx={{ height: 80, width: 'auto' }} />
      <Box sx={{ textAlign: 'center', color: '#fff' }}>
        <Typography variant="h4" fontWeight="bold">
          <ManualIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 36 }} />
          Manuales de Usuario
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
          Módulo de Correspondencia · Plataforma de Gestión Documental Municipal
        </Typography>
      </Box>

      <Grid container spacing={2} justifyContent="center" sx={{ maxWidth: 1000 }}>
        {MANUALES.map((m) => (
          <Grid item xs={12} sm={6} md={4} key={m.rol}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <CorporateColorBar height={5} />
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', textAlign: 'center', p: 3 }}>
                {m.icono}
                <Typography variant="h6" fontWeight="bold" color="primary" sx={{ mt: 1 }}>
                  {m.rol}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, flex: 1 }}>
                  {m.descripcion}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  component="a"
                  href={m.archivo}
                  download
                  sx={{ mt: 2 }}
                >
                  Descargar PDF
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Button variant="text" size="small" sx={{ color: '#fff' }} onClick={() => navigate('/login')}>
        Ir al inicio de sesión
      </Button>
    </Box>
  )
}

export default Manuales
