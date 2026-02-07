import api from './axios'
import { ApiResponse, Departamento, User, Notificacion, PaginatedResponse } from '../types'

// API de Departamentos
export const departamentosAPI = {
  listar: async () => {
    const response = await api.get<ApiResponse<Departamento[]>>('/departamentos')
    return response.data
  },

  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<Departamento>>(`/departamentos/${id}`)
    return response.data
  },

  crear: async (data: { nombre: string; codigo?: string }) => {
    const response = await api.post<ApiResponse<Departamento>>('/departamentos', data)
    return response.data
  },

  actualizar: async (id: number, data: { nombre?: string; codigo?: string; activo?: boolean }) => {
    const response = await api.put<ApiResponse<Departamento>>(`/departamentos/${id}`, data)
    return response.data
  },

  eliminar: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/departamentos/${id}`)
    return response.data
  },
}

// API de Usuarios
export const usersAPI = {
  listar: async (filters?: { activo?: boolean; departamento_id?: number }) => {
    const response = await api.get<ApiResponse<PaginatedResponse<User>>>('/users', { params: filters })
    return response.data
  },

  funcionarios: async () => {
    const response = await api.get<ApiResponse<User[]>>('/users/funcionarios')
    return response.data
  },

  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<User>>(`/users/${id}`)
    return response.data
  },

  crear: async (data: {
    rut: string
    password: string
    nombre: string
    email?: string
    roles: string[]
    aplicaciones_permitidas?: string[]
    departamento_id?: number
    visador?: boolean
  }) => {
    const response = await api.post<ApiResponse<User>>('/users', data)
    return response.data
  },

  actualizar: async (
    id: number,
    data: {
      nombre?: string
      email?: string
      roles?: string[]
      aplicaciones_permitidas?: string[]
      departamento_id?: number
      visador?: boolean
    }
  ) => {
    const response = await api.put<ApiResponse<User>>(`/users/${id}`, data)
    return response.data
  },

  desactivar: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/users/${id}`)
    return response.data
  },

  activar: async (id: number) => {
    const response = await api.post<ApiResponse<User>>(`/users/${id}/activate`)
    return response.data
  },

  cambiarPassword: async (id: number, password: string, passwordConfirmation: string) => {
    const response = await api.post<ApiResponse<null>>(`/users/${id}/change-password`, {
      password,
      password_confirmation: passwordConfirmation,
    })
    return response.data
  },
}

// API Hora Oficial (NTP SHOA - America/Punta_Arenas)
export const horaOficialAPI = {
  obtener: async () => {
    const response = await api.get<ApiResponse<{
      timestamp: string
      unix: number
      timezone: string
      formatted: string
      fecha: string
    }>>('/hora-oficial')
    return response.data
  },
}

// API de Notificaciones
export const notificacionesAPI = {
  listar: async () => {
    const response = await api.get<ApiResponse<Notificacion[]>>('/notificaciones')
    return response.data
  },

  noLeidas: async () => {
    const response = await api.get<ApiResponse<Notificacion[]>>('/notificaciones/no-leidas')
    return response.data
  },

  marcarLeida: async (id: number) => {
    const response = await api.post<ApiResponse<null>>(`/notificaciones/${id}/leer`)
    return response.data
  },

  marcarTodasLeidas: async () => {
    const response = await api.post<ApiResponse<null>>('/notificaciones/leer-todas')
    return response.data
  },
}
