import api from './axios'
import { ApiResponse, Espacio, Reserva } from '../types'

export interface EspaciosResponse {
  espacios: Espacio[]
  puede_gestionar: boolean
}

export interface ReservaInput {
  espacio_id?: number
  titulo: string
  descripcion?: string
  inicio: string // ISO
  fin: string // ISO
  asistente_ids?: number[]
}

export interface EspacioInput {
  nombre: string
  descripcion?: string
  ubicacion?: string
  capacidad?: number | null
  color?: string
  activo?: boolean
  administrador_ids?: number[]
}

export const reservasAPI = {
  // --- Espacios ---
  espaciosListar: async (incluirInactivos = false) => {
    const response = await api.get<ApiResponse<EspaciosResponse>>('/espacios', {
      params: incluirInactivos ? { incluir_inactivos: 1 } : undefined,
    })
    return response.data
  },

  espacioCrear: async (data: EspacioInput) => {
    const response = await api.post<ApiResponse<Espacio>>('/espacios', data)
    return response.data
  },

  espacioActualizar: async (id: number, data: EspacioInput) => {
    const response = await api.put<ApiResponse<Espacio>>(`/espacios/${id}`, data)
    return response.data
  },

  espacioEliminar: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/espacios/${id}`)
    return response.data
  },

  // --- Reservas ---
  reservasListar: async (espacioId: number, desde?: string, hasta?: string) => {
    const response = await api.get<ApiResponse<Reserva[]>>('/reservas', {
      params: { espacio_id: espacioId, desde, hasta },
    })
    return response.data
  },

  reservaCrear: async (data: ReservaInput) => {
    const response = await api.post<ApiResponse<Reserva>>('/reservas', data)
    return response.data
  },

  reservaActualizar: async (id: number, data: ReservaInput) => {
    const response = await api.put<ApiResponse<Reserva>>(`/reservas/${id}`, data)
    return response.data
  },

  reservaAprobar: async (id: number) => {
    const response = await api.post<ApiResponse<Reserva>>(`/reservas/${id}/aprobar`)
    return response.data
  },

  reservaRechazar: async (id: number, motivo_rechazo?: string) => {
    const response = await api.post<ApiResponse<Reserva>>(`/reservas/${id}/rechazar`, { motivo_rechazo })
    return response.data
  },

  reservaCancelar: async (id: number) => {
    const response = await api.post<ApiResponse<Reserva>>(`/reservas/${id}/cancelar`)
    return response.data
  },

  reservasPendientes: async () => {
    const response = await api.get<ApiResponse<Reserva[]>>('/reservas/pendientes')
    return response.data
  },
}
