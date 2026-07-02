import api from './axios'
import { ApiResponse, SubrogadoActivo, User } from '../types'

export interface LoginResponse {
  token: string
  user: User
}

export interface SubroganciaTokenResponse {
  token: string
  subrogado: SubrogadoActivo
}

// Perfil del funcionario auditado (modo "ver como" del admin).
export interface AuditarFuncionario {
  id: number
  nombre: string
  cargo: string | null
  roles: string[]
  aplicaciones_permitidas: string[]
  departamento_id: number | null
  puede_ver_registro_correspondencia: boolean
}

export const authAPI = {
  login: async (rut: string, password: string, forzar = false) => {
    const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', {
      rut,
      password,
      forzar,
    })
    return response.data
  },

  logout: async () => {
    const response = await api.post<ApiResponse<null>>('/auth/logout')
    return response.data
  },

  subroganciaToken: async (subrogadoId: number, forzar = false) => {
    const response = await api.post<ApiResponse<SubroganciaTokenResponse>>('/auth/subrogancia-token', {
      subrogado_id: subrogadoId,
      forzar,
    })
    return response.data
  },

  subroganciaLogout: async () => {
    const response = await api.post<ApiResponse<null>>('/auth/subrogancia-logout')
    return response.data
  },

  // Modo auditoría (admin "ver como", solo lectura). Devuelve el perfil del
  // funcionario para que el frontend arme su vista.
  auditarIniciar: async (funcionarioId: number) => {
    const response = await api.post<ApiResponse<{ funcionario: AuditarFuncionario }>>('/auth/auditar', {
      funcionario_id: funcionarioId,
    })
    return response.data
  },

  auditarLogout: async () => {
    const response = await api.post<ApiResponse<null>>('/auth/auditar-logout')
    return response.data
  },

  me: async () => {
    const response = await api.get<ApiResponse<User>>('/auth/me')
    return response.data
  },

  changePassword: async (currentPassword: string, password: string, passwordConfirmation: string) => {
    const response = await api.post<ApiResponse<null>>('/auth/change-password', {
      current_password: currentPassword,
      password,
      password_confirmation: passwordConfirmation,
    })
    return response.data
  },

  updateProfile: async (data: { cargo?: string }) => {
    const response = await api.put<ApiResponse<User>>('/auth/profile', data)
    return response.data
  },

  forgotPassword: async (rut: string) => {
    const response = await api.post<ApiResponse<null>>('/auth/forgot-password', { rut })
    return response.data
  },

  resetPassword: async (token: string, password: string, passwordConfirmation: string) => {
    const response = await api.post<ApiResponse<null>>('/auth/reset-password', {
      token,
      password,
      password_confirmation: passwordConfirmation,
    })
    return response.data
  },
}
