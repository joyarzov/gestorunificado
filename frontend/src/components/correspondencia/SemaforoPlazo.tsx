import { Chip, Tooltip } from '@mui/material'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type Nivel = 'verde' | 'amarillo' | 'rojo' | null | undefined

interface SemaforoPlazoProps {
  nivel: Nivel
  /** Fecha límite en formato YYYY-MM-DD. */
  fecha?: string | null
}

const CONFIG: Record<'verde' | 'amarillo' | 'rojo', { color: 'success' | 'warning' | 'error'; emoji: string }> = {
  verde: { color: 'success', emoji: '🟢' },
  amarillo: { color: 'warning', emoji: '🟡' },
  rojo: { color: 'error', emoji: '🔴' },
}

/**
 * Chip-semáforo del plazo de respuesta. No renderiza nada si no hay plazo o ya se
 * cumplió (nivel null). 🟢 holgado · 🟡 por vencer (≤2 días) · 🔴 vencido.
 */
const SemaforoPlazo = ({ nivel, fecha }: SemaforoPlazoProps) => {
  if (!nivel) return null

  const { color, emoji } = CONFIG[nivel]
  // La fecha puede llegar como 'YYYY-MM-DD' (seguimiento) o ISO completo (bandeja):
  // tomar solo la parte de día y anclarla a medianoche local evita corrimientos de TZ.
  const fechaDia = fecha ? fecha.slice(0, 10) : null
  const fechaFmt = fechaDia ? format(new Date(`${fechaDia}T00:00:00`), "d 'de' MMMM", { locale: es }) : null

  const label =
    nivel === 'rojo'
      ? fechaFmt
        ? `Plazo vencido (${fechaFmt})`
        : 'Plazo vencido'
      : fechaFmt
        ? `Responder antes del ${fechaFmt}`
        : 'Con plazo de respuesta'

  return (
    <Tooltip title={nivel === 'rojo' ? 'El plazo de respuesta ya venció' : 'Tiene un plazo de respuesta fijado por el alcalde'}>
      <Chip
        label={`${emoji} ${label}`}
        color={color}
        size="small"
        variant={nivel === 'rojo' ? 'filled' : 'outlined'}
      />
    </Tooltip>
  )
}

export default SemaforoPlazo
