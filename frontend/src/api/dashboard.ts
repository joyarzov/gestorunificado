import api from './axios'
import { ApiResponse } from '../types'

export interface DashboardData {
  correspondencia: {
    total: number
    pendientes: number
    en_proceso: number
    completadas: number
    archivadas: number
    pendientes_bandeja: number
    ingresadas_hoy: number
  }
  oirs: {
    total: number
    pendientes: number
    en_proceso: number
    respondidas: number
    mis_asignadas: number
    proximas_vencer: number
    por_tipo: Record<string, number>
  }
  gestor: {
    documentos_total: number
    documentos_borrador: number
    documentos_pendiente_firma: number
    documentos_firmados: number
    mis_pendientes_firma: number
    expedientes_abiertos: number
    expedientes_total: number
    creados_este_mes: number
  }
  actividad_reciente: Array<{
    tipo: 'correspondencia' | 'documento' | 'oirs'
    titulo: string
    descripcion: string
    estado: string
    fecha: string
    id: number
  }>
  resumen_mensual: Array<{
    mes: string
    correspondencia: number
    documentos: number
    oirs: number
  }>
}

export const dashboardAPI = {
  resumen: async () => {
    const response = await api.get<ApiResponse<DashboardData>>('/dashboard/resumen')
    return response.data
  },
}
