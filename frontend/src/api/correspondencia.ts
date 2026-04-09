import api from './axios'
import { ApiResponse, Correspondencia, PaginatedResponse, Derivacion, Adjunto } from '../types'

export interface CorrespondenciaFilters {
  page?: number
  per_page?: number
  estado?: string
  departamento_id?: number
  fecha_desde?: string
  fecha_hasta?: string
  search?: string
}

export interface CreateCorrespondenciaData {
  numero_documento?: string
  remitente: string
  fecha_documento?: string
  fecha_recibo: string
  descripcion?: string
  departamento_id?: number
}

export interface CreateDerivacionData {
  correspondencia_id: number
  departamento_destino_id: number
  usuario_destino_id?: number
  observaciones?: string
  acciones_para?: string[]
  otp?: string
}

export interface AlcaldeInfo {
  user_id: number
  nombre: string
  departamento_id: number
  departamento_nombre: string
}

export const correspondenciaAPI = {
  // Correspondencia
  listar: async (params?: CorrespondenciaFilters) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Correspondencia>>>('/correspondencia', { params })
    return response.data
  },

  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<Correspondencia>>(`/correspondencia/${id}`)
    return response.data
  },

  crear: async (data: CreateCorrespondenciaData) => {
    const response = await api.post<ApiResponse<Correspondencia>>('/correspondencia', data)
    return response.data
  },

  actualizar: async (id: number, data: Partial<CreateCorrespondenciaData>) => {
    const response = await api.put<ApiResponse<Correspondencia>>(`/correspondencia/${id}`, data)
    return response.data
  },

  eliminar: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/correspondencia/${id}`)
    return response.data
  },

  bandeja: async (params?: CorrespondenciaFilters) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Derivacion>>>('/correspondencia/bandeja', { params })
    return response.data
  },

  obtenerAlcaldeInfo: async () => {
    const response = await api.get<ApiResponse<AlcaldeInfo>>('/correspondencia/alcalde-info')
    return response.data
  },

  estadisticas: async () => {
    const response = await api.get<ApiResponse<{
      total: number
      pendientes: number
      en_proceso: number
      archivadas: number
    }>>('/correspondencia/estadisticas')
    return response.data
  },

  search: async (query: string, params?: CorrespondenciaFilters) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Correspondencia>>>('/correspondencia/search', {
      params: { ...params, search: query },
    })
    return response.data
  },

  // Derivaciones
  derivar: async (data: CreateDerivacionData) => {
    const response = await api.post<ApiResponse<Derivacion>>('/derivaciones', data)
    return response.data
  },

  derivacionesPendientes: async () => {
    const response = await api.get<ApiResponse<Derivacion[]>>('/derivaciones/pendientes')
    return response.data
  },

  recibirDerivacion: async (id: number, otp?: string) => {
    const response = await api.post<ApiResponse<Derivacion>>(
      `/derivaciones/${id}/recibir`,
      otp ? { otp } : {}
    )
    return response.data
  },

  archivarDerivacion: async (id: number) => {
    const response = await api.post<ApiResponse<Derivacion>>(`/derivaciones/${id}/archivar`)
    return response.data
  },

  // Adjuntos
  subirAdjunto: async (correspondenciaId: number, file: File) => {
    const formData = new FormData()
    formData.append('archivo', file)
    const response = await api.post<ApiResponse<Adjunto>>(
      `/adjuntos/correspondencia/${correspondenciaId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  eliminarAdjunto: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/adjuntos/${id}`)
    return response.data
  },

  descargarAdjunto: async (id: number) => {
    const response = await api.get(`/adjuntos/${id}/descargar`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Providencia
  descargarProvidencia: async (correspondenciaId: number) => {
    const response = await api.get(`/correspondencia/${correspondenciaId}/providencia`, {
      responseType: 'blob',
    })
    return response.data
  },
}
