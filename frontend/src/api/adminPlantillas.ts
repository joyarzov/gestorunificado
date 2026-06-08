import api from './axios'
import { ApiResponse, DocumentoPlantilla } from '../types'

// Mantenedor de plantillas de documentos (solo admin).
// Los endpoints devuelven ApiResponse<...>; las funciones retornan response.data.
export const adminPlantillasAPI = {
  listar: async () => {
    const response = await api.get<ApiResponse<DocumentoPlantilla[]>>('/documento-plantillas')
    return response.data
  },

  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<DocumentoPlantilla>>(`/documento-plantillas/${id}`)
    return response.data
  },

  actualizar: async (id: number, data: Partial<DocumentoPlantilla>) => {
    const response = await api.put<ApiResponse<DocumentoPlantilla>>(`/documento-plantillas/${id}`, data)
    return response.data
  },

  duplicar: async (id: number) => {
    const response = await api.post<ApiResponse<DocumentoPlantilla>>(`/documento-plantillas/${id}/duplicar`)
    return response.data
  },

  toggleActivo: async (id: number) => {
    const response = await api.patch<ApiResponse<DocumentoPlantilla>>(`/documento-plantillas/${id}/toggle-activo`)
    return response.data
  },

  eliminar: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/documento-plantillas/${id}`)
    return response.data
  },
}
