import api from './axios'
import { ApiResponse, OirsSolicitud, PaginatedResponse } from '../types'

export interface OirsFilters {
  page?: number
  per_page?: number
  estado?: string
  tipo_solicitud?: string
  categoria?: string
  prioridad?: string
  fecha_desde?: string
  fecha_hasta?: string
  search?: string
}

export interface CreateOirsSolicitudData {
  tipo_solicitud: string
  nombre_solicitante: string
  rut_solicitante?: string
  email_solicitante: string
  telefono_solicitante?: string
  direccion_solicitante?: string
  comuna_solicitante?: string
  anonimo?: boolean
  categoria: string
  unidad_municipal?: string
  asunto: string
  descripcion: string
  fecha_hecho?: string
  lugar_hecho?: string
  medio_respuesta?: string
}

export const oirsAPI = {
  // Admin - Listar solicitudes
  listar: async (params?: OirsFilters) => {
    const response = await api.get<ApiResponse<PaginatedResponse<OirsSolicitud>>>('/oirs', { params })
    return response.data
  },

  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<OirsSolicitud>>(`/oirs/${id}`)
    return response.data
  },

  misAsignadas: async (params?: OirsFilters) => {
    const response = await api.get<ApiResponse<PaginatedResponse<OirsSolicitud>>>('/oirs/mis-asignadas', { params })
    return response.data
  },

  estadisticas: async () => {
    const response = await api.get<ApiResponse<{
      total: number
      pendientes: number
      en_proceso: number
      respondidas: number
      por_tipo: Record<string, number>
      por_categoria: Record<string, number>
    }>>('/oirs/estadisticas')
    return response.data
  },

  asignar: async (id: number, funcionarioId: number, unidadId?: number) => {
    const response = await api.post<ApiResponse<OirsSolicitud>>(`/oirs/${id}/asignar`, {
      funcionario_asignado_id: funcionarioId,
      unidad_responsable_id: unidadId,
    })
    return response.data
  },

  responder: async (id: number, respuesta: string) => {
    const response = await api.post<ApiResponse<OirsSolicitud>>(`/oirs/${id}/responder`, {
      respuesta,
    })
    return response.data
  },

  derivar: async (id: number, unidadId: number, observaciones?: string) => {
    const response = await api.post<ApiResponse<OirsSolicitud>>(`/oirs/${id}/derivar`, {
      unidad_responsable_id: unidadId,
      observaciones,
    })
    return response.data
  },

  cerrar: async (id: number) => {
    const response = await api.post<ApiResponse<OirsSolicitud>>(`/oirs/${id}/cerrar`)
    return response.data
  },
}

// API para funcionarios (cualquier usuario autenticado con solicitudes asignadas)
export const oirsFuncionarioAPI = {
  misAsignadas: async (params?: OirsFilters) => {
    const response = await api.get<ApiResponse<PaginatedResponse<OirsSolicitud>>>('/oirs-funcionario/mis-asignadas', { params })
    return response.data
  },

  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<OirsSolicitud>>(`/oirs-funcionario/${id}`)
    return response.data
  },

  estadisticas: async () => {
    const response = await api.get<ApiResponse<{
      total_asignadas: number
      pendientes_respuesta: number
      en_analisis: number
      respondidas: number
      proximas_vencer: number
    }>>('/oirs-funcionario/estadisticas')
    return response.data
  },

  responderInterno: async (id: number, respuesta: string, archivo?: File) => {
    const formData = new FormData()
    formData.append('respuesta', respuesta)
    if (archivo) {
      formData.append('archivo', archivo)
    }

    const response = await api.post<ApiResponse<OirsSolicitud>>(`/oirs-funcionario/${id}/responder`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
}

// API pública de OIRS (sin autenticación)
export const oirsPublicoAPI = {
  crear: async (data: CreateOirsSolicitudData, archivos?: File[]) => {
    const formData = new FormData()

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    })

    if (archivos) {
      archivos.forEach((file) => {
        formData.append('archivos[]', file)
      })
    }

    const response = await api.post<ApiResponse<{ folio: string; codigo_seguimiento?: string }>>('/oirs-publico', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  consultar: async (folio: string, credencial?: { rut?: string; codigo_seguimiento?: string }) => {
    const response = await api.get<ApiResponse<OirsSolicitud>>('/oirs-publico/consultar', {
      params: { folio, ...(credencial ?? {}) },
    })
    return response.data
  },

  adjuntar: async (folio: string, rut: string, archivo: File) => {
    const formData = new FormData()
    formData.append('folio', folio)
    formData.append('rut', rut)
    formData.append('archivo', archivo)

    const response = await api.post<ApiResponse<{ id: number }>>('/oirs-publico/adjuntar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
}
