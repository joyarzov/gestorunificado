import { useEffect, useState } from 'react'
import { Box, Typography, LinearProgress } from '@mui/material'
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
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        bgcolor: 'rgba(255, 255, 255, 0.94)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        p: 3,
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

      <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, maxWidth: 360 }}>
        {paso.texto}
      </Typography>

      <Box sx={{ width: '100%', maxWidth: 320 }}>
        <LinearProgress sx={{ height: 6, borderRadius: 3 }} />
      </Box>

      <Typography variant="caption" color="text.secondary">
        No cierres ni recargues la página{segundos >= 4 ? ` — ${segundos}s` : ''}
      </Typography>
    </Box>
  )
}
