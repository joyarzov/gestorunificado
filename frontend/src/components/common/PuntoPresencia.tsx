import { Box } from '@mui/material'
import { EstadoPresencia } from '../../api/common'

export const COLOR_PRESENCIA: Record<EstadoPresencia, string> = {
  en_linea: '#2DC700',   // verde de la barra corporativa
  desconectado: '#BDBDBD',
}

export const ETIQUETA_PRESENCIA: Record<EstadoPresencia, string> = {
  en_linea: 'Tiene la plataforma abierta ahora',
  desconectado: 'No está usando la plataforma',
}

/**
 * Punto de color con el estado de conexión de una persona.
 *
 * Vive aparte para poder acompañar cualquier nombre de la plataforma (el globo
 * del chat, el selector de destinatarios al derivar) sin arrastrar consigo el
 * componente del globo entero.
 */
const PuntoPresencia = ({ estado, size = 10 }: { estado: EstadoPresencia; size?: number }) => (
  <Box
    component="span"
    title={ETIQUETA_PRESENCIA[estado]}
    sx={{
      width: size,
      height: size,
      borderRadius: '50%',
      bgcolor: COLOR_PRESENCIA[estado],
      flexShrink: 0,
      display: 'inline-block',
      border: estado === 'desconectado' ? '1px solid #9e9e9e' : 'none',
    }}
  />
)

export default PuntoPresencia
