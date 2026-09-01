import { useState } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import {
  Star as SeguidaIcon,
  StarBorder as NoSeguidaIcon,
} from '@mui/icons-material'
import { correspondenciaAPI } from '../../api/correspondencia'

interface Props {
  correspondenciaId: number
  /** Estado inicial que viene del listado (`en_seguimiento`). */
  seguida?: boolean
  /** Se llama tras confirmar el cambio en el servidor, con el estado nuevo. */
  onChange?: (seguida: boolean) => void
  size?: 'small' | 'medium'
}

/**
 * Estrella para marcar una correspondencia en seguimiento personal.
 *
 * El seguimiento es de cada usuario: nadie ve lo que otro marcó. Se usa en los
 * listados, donde vive dentro de una fila clickeable, por eso detiene la
 * propagación del click.
 *
 * Es optimista: pinta el cambio de inmediato y lo revierte si el servidor
 * falla. Marcar y desmarcar tiene que sentirse instantáneo o no se usa.
 */
const EstrellaSeguimiento = ({ correspondenciaId, seguida = false, onChange, size = 'small' }: Props) => {
  const [activa, setActiva] = useState(seguida)
  const [guardando, setGuardando] = useState(false)

  const alternar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (guardando) return

    const nuevo = !activa
    setActiva(nuevo)
    setGuardando(true)
    try {
      if (nuevo) {
        await correspondenciaAPI.seguir(correspondenciaId)
      } else {
        await correspondenciaAPI.dejarDeSeguir(correspondenciaId)
      }
      onChange?.(nuevo)
    } catch (err) {
      setActiva(!nuevo) // revertir: el servidor mandó
      console.error('No se pudo cambiar el seguimiento:', err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tooltip title={activa ? 'Quitar de seguimiento' : 'Seguir esta correspondencia'}>
      <IconButton
        size={size}
        onClick={alternar}
        sx={{ p: 0.25, color: activa ? 'warning.main' : 'action.disabled' }}
        aria-label={activa ? 'Quitar de seguimiento' : 'Seguir esta correspondencia'}
      >
        {activa ? <SeguidaIcon fontSize="inherit" /> : <NoSeguidaIcon fontSize="inherit" />}
      </IconButton>
    </Tooltip>
  )
}

export default EstrellaSeguimiento
