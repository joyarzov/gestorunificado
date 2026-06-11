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
  // ciclo de entrada
  pendiente: { label: 'Pendiente', color: 'warning' },
  derivada_alcaldia: { label: 'Derivada a Alcaldía', color: 'secondary' },
  en_proceso: { label: 'En Proceso', color: 'info' },
  derivada_funcionario: { label: 'Derivada a Funcionario', color: 'info' },
  // "completada" en BD = todos los destinatarios acusaron recibo (el ciclo
  // de recepción terminó, no necesariamente la gestión de fondo).
  completada: { label: 'Recibida por destinatarios', color: 'success' },
  archivado: { label: 'Archivada', color: 'success' },
  // ciclo de salida
  reservada: { label: 'N° Reservado', color: 'warning' },
  por_despachar: { label: 'Por Despachar', color: 'info' },
  despachada: { label: 'Despachada', color: 'success' },
  devuelta: { label: 'Devuelta', color: 'error' },
  anulada: { label: 'Anulada', color: 'default' },
}

export const TIPOS_DOCUMENTO_SALIDA: Record<string, string> = {
  oficio: 'Oficio',
  ordinario: 'Ordinario',
  circular: 'Circular',
  carta: 'Carta',
}

export const MEDIOS_DESPACHO: Record<string, string> = {
  email: 'Correo electrónico',
  carta_certificada: 'Carta certificada',
  en_mano: 'Entrega en mano',
  libro: 'Libro de despacho',
  otro: 'Otro',
}

/** Estados del ciclo de entrada (para selects de filtro de los listados de entrada). */
export const ESTADOS_ENTRADA = [
  'pendiente', 'derivada_alcaldia', 'en_proceso', 'derivada_funcionario', 'completada', 'archivado',
] as const

export const estadoCorrespondencia = (estado: string) =>
  ESTADO_CORRESPONDENCIA[estado as Correspondencia['estado']] ?? {
    label: estado,
    color: 'default' as ChipColor,
  }
