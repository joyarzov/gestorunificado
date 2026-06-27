import { Box, Chip, Tooltip, Typography } from '@mui/material'
import {
  HowToReg as AcuseIcon,
  ChatBubbleOutline as RespondioIcon,
} from '@mui/icons-material'
import { Correspondencia } from '../../types'

interface Props {
  correspondencia: Correspondencia
  /** 'detalle' = línea completa con nombres; 'lista' = chips compactos. */
  variant?: 'detalle' | 'lista'
}

/**
 * Complementa el estado "Derivada a Funcionario" mostrando cuántos
 * destinatarios activos dieron acuse de recibo y quiénes respondieron en la
 * conversación. No es un estado nuevo: se calcula en el backend a partir de
 * las derivaciones activas y los mensajes.
 */
const ResumenGestion = ({ correspondencia, variant = 'detalle' }: Props) => {
  const resumen = correspondencia.resumen_gestion
  // Solo aplica mientras la correspondencia está en gestión de funcionarios.
  if (
    !resumen ||
    resumen.destinatarios === 0 ||
    !['derivada_funcionario', 'completada'].includes(correspondencia.estado)
  ) {
    return null
  }

  const { destinatarios, con_acuse, respondieron } = resumen
  const todos = con_acuse >= destinatarios
  const acuseColor = todos ? 'success' : con_acuse > 0 ? 'info' : 'warning'
  const nombres = respondieron.map((r) => r.nombre).join(', ')

  if (variant === 'lista') {
    return (
      <Box sx={{ display: 'inline-flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip title={`${con_acuse} de ${destinatarios} destinatarios dieron acuse de recibo`}>
          <Chip
            size="small"
            icon={<AcuseIcon sx={{ fontSize: 14 }} />}
            label={`${con_acuse}/${destinatarios} acuses`}
            color={acuseColor}
            variant="outlined"
            sx={{ height: 20, fontSize: 11 }}
          />
        </Tooltip>
        {respondieron.length > 0 && (
          <Tooltip title={`Respondieron: ${nombres}`}>
            <Chip
              size="small"
              icon={<RespondioIcon sx={{ fontSize: 13 }} />}
              label={`${respondieron.length} respondió${respondieron.length > 1 ? 'eron' : ''}`}
              color="secondary"
              variant="outlined"
              sx={{ height: 20, fontSize: 11 }}
            />
          </Tooltip>
        )}
      </Box>
    )
  }

  // variant 'detalle'
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
      <Chip
        size="small"
        icon={<AcuseIcon sx={{ fontSize: 16 }} />}
        label={`${con_acuse} de ${destinatarios} con acuse de recibo`}
        color={acuseColor}
        variant="outlined"
      />
      {respondieron.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <RespondioIcon sx={{ fontSize: 16 }} color="action" />
          Respondieron: <strong>{nombres}</strong>
        </Typography>
      )}
    </Box>
  )
}

export default ResumenGestion
