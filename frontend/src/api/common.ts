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

  crear: async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
  ) => {
    const response = await api.post<ApiResponse<User>>('/users', data)
    return response.data
  },

  actualizar: async (
    id: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
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

  // Envía al usuario un correo de acceso con clave temporal y lo obliga a
  // cambiarla en el próximo login. tipo: 'bienvenida' (incorporación) o 'reset'.
  enviarAcceso: async (id: number, tipo: 'bienvenida' | 'reset') => {
    const response = await api.post<ApiResponse<null>>(`/users/${id}/enviar-acceso`, { tipo })
    return response.data
  },
}

export interface AdminDashboardStats {
  usuarios: { activos: number; inactivos: number; sin_primer_ingreso: number; clave_pendiente: number }
  correspondencia: { total: number; entradas: number; salidas: number; archivadas: number; salidas_pendientes: number }
  documentos: { total: number; borrador: number; pendiente_firma: number; firmado: number }
  expedientes: number
  oirs: number
}

export const adminAPI = {
  dashboard: async () => {
    const response = await api.get<ApiResponse<AdminDashboardStats>>('/admin/dashboard')
    return response.data
  },
}

// Delegación de emisión: qué titulares puede representar cada delegado (solo admin).
export interface DelegacionEmision {
  delegado: { id: number; nombre: string; cargo: string | null }
  titulares: { id: number; nombre: string; cargo: string | null }[]
}

export const delegacionesEmisionAPI = {
  listar: async () => {
    const response = await api.get<ApiResponse<DelegacionEmision[]>>('/delegaciones-emision')
    return response.data
  },
  // Reemplaza el conjunto de titulares que un delegado puede representar.
  actualizar: async (delegadoId: number, titularIds: number[]) => {
    const response = await api.put<ApiResponse<unknown>>(`/delegaciones-emision/${delegadoId}`, {
      titular_ids: titularIds,
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

/** Estado de presencia de un usuario en la plataforma. */
export type EstadoPresencia = 'en_linea' | 'ausente' | 'desconectado'

export interface UsuarioPresencia {
  id: number
  nombre: string
  cargo?: string | null
  departamento?: string | null
  estado: EstadoPresencia
  /** Última actividad registrada (ISO 8601). Null si nunca se ha conectado. */
  visto_at?: string | null
}

export interface PresenciaResponse {
  usuarios: UsuarioPresencia[]
  umbrales: { en_linea: number; ausente: number }
}

export const presenciaAPI = {
  listar: async () => {
    const response = await api.get<ApiResponse<PresenciaResponse>>('/presencia')
    return response.data
  },
}

// ---------------------------------------------------------------------------
// Chat interno (canal informal; lo formal va a la Conversación del expediente)
// ---------------------------------------------------------------------------

export interface ChatInterlocutor {
  id: number
  nombre: string
  cargo?: string | null
}

export interface ChatConversacionResumen {
  id: number
  interlocutor: ChatInterlocutor | null
  ultimo_mensaje: { cuerpo: string; mio: boolean; fecha: string } | null
  no_leidos: number
  ultimo_mensaje_at?: string | null
}

export interface ChatMensaje {
  id: number
  cuerpo: string
  mio: boolean
  autor?: string | null
  fecha: string
}

export interface ChatHilo {
  conversacion_id: number
  interlocutor: ChatInterlocutor | null
  mensajes: ChatMensaje[]
}

export const chatAPI = {
  conversaciones: async () => {
    const response = await api.get<ApiResponse<{ conversaciones: ChatConversacionResumen[]; no_leidos: number }>>('/chat')
    return response.data
  },

  /** Solo el contador, para el badge: mucho más barato que traer todo. */
  noLeidos: async () => {
    const response = await api.get<ApiResponse<{ no_leidos: number }>>('/chat/no-leidos')
    return response.data
  },

  mensajes: async (conversacionId: number) => {
    const response = await api.get<ApiResponse<ChatHilo>>(`/chat/${conversacionId}/mensajes`)
    return response.data
  },

  enviar: async (destinatarioId: number, cuerpo: string) => {
    const response = await api.post<ApiResponse<{ conversacion_id: number; mensaje: ChatMensaje }>>(
      '/chat/mensajes',
      { destinatario_id: destinatarioId, cuerpo }
    )
    return response.data
  },

  marcarLeida: async (conversacionId: number) => {
    const response = await api.post<ApiResponse<{ leido: boolean }>>(`/chat/${conversacionId}/leida`)
    return response.data
  },
}
