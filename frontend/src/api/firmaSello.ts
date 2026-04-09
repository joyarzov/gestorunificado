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

  preview: async (params: Record<string, string | boolean>, logoFile?: File | null) => {
    if (logoFile) {
      // Enviar como multipart para incluir el logo seleccionado localmente
      const form = new FormData()
      Object.entries(params).forEach(([k, v]) => form.append(k, String(v)))
      form.append('logo_preview', logoFile)
      const res = await api.post('/firma-sellos/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
      })
      return res.data as Blob
    }
    // Sin logo: POST JSON normal
    const res = await api.post('/firma-sellos/preview', params, {
      responseType: 'blob',
    })
    return res.data as Blob
  },
}
