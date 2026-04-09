import api from './axios'
import { ApiResponse, FirmaSello } from '../types'

export const firmaSelloAPI = {
  listar: async () => {
    const res = await api.get<ApiResponse<FirmaSello[]>>('/firma-sellos')
    return res.data
  },

  obtener: async (id: number) => {
    const res = await api.get<ApiResponse<FirmaSello>>(`/firma-sellos/${id}`)
    return res.data
  },

  crear: async (data: Partial<FirmaSello>) => {
    const res = await api.post<ApiResponse<FirmaSello>>('/firma-sellos', data)
    return res.data
  },

  actualizar: async (id: number, data: Partial<FirmaSello>) => {
    const res = await api.put<ApiResponse<FirmaSello>>(`/firma-sellos/${id}`, data)
    return res.data
  },

  eliminar: async (id: number) => {
    const res = await api.delete<ApiResponse<null>>(`/firma-sellos/${id}`)
    return res.data
  },

  subirLogo: async (id: number, archivo: File) => {
    const form = new FormData()
    form.append('logo', archivo)
    const res = await api.post<ApiResponse<FirmaSello>>(`/firma-sellos/${id}/logo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  activar: async (id: number) => {
    const res = await api.patch<ApiResponse<FirmaSello>>(`/firma-sellos/${id}/activar`)
    return res.data
  },

  previewUrl: (params: Record<string, string | boolean>) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString()
    return `/api/firma-sellos/preview?${qs}`
  },
}
