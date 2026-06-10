import { Correspondencia } from '../types'

type ChipColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error'

/**
 * Catálogo ÚNICO de estados de correspondencia: misma etiqueta y color en
 * dashboard, listado, búsqueda y detalle. No duplicar estos mapas por página.
 */
export const ESTADO_CORRESPONDENCIA: Record<
  Correspondencia['estado'],
  { label: string; color: ChipColor }
> = {
  pendiente: { label: 'Pendiente', color: 'warning' },
  derivada_alcaldia: { label: 'Derivada a Alcaldía', color: 'secondary' },
  en_proceso: { label: 'En Proceso', color: 'info' },
  derivada_funcionario: { label: 'Derivada a Funcionario', color: 'info' },
  completada: { label: 'Completada', color: 'success' },
  archivado: { label: 'Archivada', color: 'success' },
}

export const estadoCorrespondencia = (estado: string) =>
  ESTADO_CORRESPONDENCIA[estado as Correspondencia['estado']] ?? {
    label: estado,
    color: 'default' as ChipColor,
  }
