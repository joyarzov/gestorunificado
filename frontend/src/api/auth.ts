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
