import api from './axios'
import { ApiResponse, User } from '../types'

export interface LoginResponse {
  token: string
  user: User
}

export const authAPI = {
  login: async (rut: string, password: string) => {
    const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', {
      rut,
      password,
    })
    return response.data
  },

  logout: async () => {
    const response = await api.post<ApiResponse<null>>('/auth/logout')
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
}
