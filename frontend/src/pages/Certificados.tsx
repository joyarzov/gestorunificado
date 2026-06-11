import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Button, Alert, Divider,
} from '@mui/material'
import {
  Https as CertIcon,
  Download as DownloadIcon,
  CheckCircle as OkIcon,
} from '@mui/icons-material'
import CorporateColorBar from '../components/branding/CorporateColorBar'

const PASOS_WINDOWS = [
  { titulo: 'Descarga el certificado', detalle: 'Usa el botón azul de arriba. Se guardará el archivo certificado-municipal.crt en tu carpeta de Descargas.' },
  { titulo: 'Ábrelo con doble clic', detalle: 'Windows mostrará la información del certificado. Pulsa el botón "Instalar certificado…".' },
  { titulo: 'Elige "Equipo local"', detalle: 'En la ubicación del almacén selecciona "Equipo local" y pulsa Siguiente (puede pedir permisos de administrador).' },
  { titulo: 'Selecciona el almacén correcto', detalle: 'Marca "Colocar todos los certificados en el siguiente almacén" → Examinar → "Entidades de certificación raíz de confianza" → Aceptar → Siguiente → Finalizar.' },
  { titulo: 'Reinicia el navegador', detalle: 'Cierra TODAS las ventanas de Chrome/Edge y vuelve a abrirlo. Al entrar a https://docmunicipal.local debe aparecer el candado 🔒.' },
]

const Certificados = () => {
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

      <Card sx={{ maxWidth: 640, width: '100%', overflow: 'hidden' }}>
        <CorporateColorBar height={5} />
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <CertIcon sx={{ fontSize: 46 }} color="primary" />
            <Typography variant="h5" fontWeight="bold" color="primary">
              Certificado de Seguridad
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Instálalo una sola vez en cada equipo para navegar la plataforma con el candado 🔒
              (HTTPS) y sin advertencias del navegador.
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<DownloadIcon />}
              component="a"
              href="/certificado-municipal.crt"
              download
            >
              Descargar certificado
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              certificado-municipal.crt · Autoridad certificadora interna de la red municipal
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="primary">Instalación en Windows</Typography>
          </Divider>

          {PASOS_WINDOWS.map((p, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
              <Box sx={{
                width: 28, height: 28, borderRadius: '50%', bgcolor: '#0071BC', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, flex: 'none',
              }}>
                {i + 1}
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={600}>{p.titulo}</Typography>
                <Typography variant="body2" color="text.secondary">{p.detalle}</Typography>
              </Box>
            </Box>
          ))}

          <Alert severity="success" icon={<OkIcon />} sx={{ mt: 2 }}>
            <strong>¿Cómo sé que quedó bien?</strong> Entra a <strong>https://docmunicipal.local</strong>:
            si ves el candado y no aparece "La conexión no es privada", está listo. Esa advertencia
            significa que falta este paso.
          </Alert>
          <Alert severity="info" sx={{ mt: 1 }}>
            En equipos administrados por Informática este paso puede venir ya hecho. Si no tienes
            permisos de administrador en tu computador, solicita la instalación a Informática Municipal.
          </Alert>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="text" size="small" sx={{ color: '#fff' }} onClick={() => navigate('/manuales')}>
          Ver manuales
        </Button>
        <Button variant="text" size="small" sx={{ color: '#fff' }} onClick={() => navigate('/login')}>
          Ir al inicio de sesión
        </Button>
      </Box>
    </Box>
  )
}

export default Certificados
