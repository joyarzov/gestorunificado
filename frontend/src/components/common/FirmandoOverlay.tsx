import { useEffect, useState } from 'react'
import { Box, Paper, Typography, LinearProgress, Fade } from '@mui/material'
import { Verified as FirmaIcon } from '@mui/icons-material'

/**
 * Estado visible mientras se firma. La llamada a FirmaGob tarda entre unos
 * segundos y medio minuto (más si el PDF hay que comprimirlo antes), y sin nada
 * en pantalla el funcionario cree que el botón no hizo nada y vuelve a apretar.
 *
 * Los textos van cambiando con el tiempo transcurrido: no es una barra de
 * progreso real —el servicio no informa avance— pero muestra que el sistema
 * sigue trabajando y desde cuándo.
 */
const PASOS = [
  { desde: 0, texto: 'Preparando el documento…' },
  { desde: 4, texto: 'Enviando a FirmaGob…' },
  { desde: 12, texto: 'Validando tu firma electrónica…' },
  { desde: 25, texto: 'Está tardando más de lo normal. No cierres esta ventana.' },
]

interface FirmandoOverlayProps {
  /** Se muestra solo mientras la firma está en curso. */
  activo: boolean
  /** Encabezado; por defecto "Firmando documento". */
  titulo?: string
}

export default function FirmandoOverlay({ activo, titulo = 'Firmando documento' }: FirmandoOverlayProps) {
  const [segundos, setSegundos] = useState(0)

  useEffect(() => {
    if (!activo) {
      setSegundos(0)
      return
    }
    const id = setInterval(() => setSegundos(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [activo])

  if (!activo) return null

  const paso = [...PASOS].reverse().find(p => segundos >= p.desde) ?? PASOS[0]

  return (
    <Fade in>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          // Fondo opaco + desenfoque: el contenido de atrás no se lee a medias
          // ni se ve "cortado" al hacer scroll del diálogo.
          bgcolor: 'rgba(246, 249, 252, 0.97)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 380,
            px: 4,
            py: 4,
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'rgba(0, 113, 188, 0.35)',
            boxShadow: '0 12px 32px rgba(15, 42, 66, 0.16)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              bgcolor: 'rgba(0, 113, 188, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'firmandoPulso 1.4s ease-in-out infinite',
              '@keyframes firmandoPulso': {
                '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(0, 113, 188, 0.35)' },
                '50%': { transform: 'scale(1.06)', boxShadow: '0 0 0 14px rgba(0, 113, 188, 0)' },
              },
            }}
          >
            <FirmaIcon sx={{ fontSize: 34, color: '#0071BC' }} />
          </Box>

          <Typography variant="h6" fontWeight="bold" color="#0071BC">
            {titulo}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
            {paso.texto}
          </Typography>

          <Box sx={{ width: '100%' }}>
            <LinearProgress sx={{ height: 6, borderRadius: 3 }} />
          </Box>

          <Typography variant="caption" color="text.secondary">
            No cierres ni recargues la página{segundos >= 4 ? ` — ${segundos}s` : ''}
          </Typography>
        </Paper>
      </Box>
    </Fade>
  )
}
