import api from './axios'
import {
  ApiResponse,
  FondoConcursable,
  Postulacion,
  PostulacionAdjunto,
  PostulacionConsulta,
  PostulacionItemFinanciamiento,
  FondoEstadisticas,
  PaginatedResponse,
} from '../types'

// ============================
// API Pública (sin auth)
// ============================
export const fondosPublicoAPI = {
  obtenerActivo: async () => {
    const response = await api.get<ApiResponse<FondoConcursable>>('/fondos-publico/activo')
    return response.data
  },

  descargarBases: async (fondoId: number) => {
    const response = await api.get(`/fondos-publico/${fondoId}/bases`, {
      responseType: 'blob',
    })
    return response.data
  },

  postular: async (data: {
    fondo_id: number
    nombre_postulante: string
    rut_postulante: string
    email_postulante?: string
    telefono_postulante?: string
    contenido_json?: Record<string, unknown>
  }) => {
    const response = await api.post<ApiResponse<{ codigo: string; id: number }>>('/fondos-publico/postular', data)
    return response.data
  },

  guardarBorrador: async (codigo: string, data: {
    rut_postulante: string
    nombre_postulante?: string
    email_postulante?: string
    telefono_postulante?: string
    contenido_json?: Record<string, unknown>
    paso_actual?: number
    items_financiamiento?: Partial<PostulacionItemFinanciamiento>[]
  }) => {
    const response = await api.put<ApiResponse<Postulacion>>(`/fondos-publico/postulacion/${codigo}`, data)
    return response.data
  },

  enviar: async (codigo: string, rut_postulante: string) => {
    const response = await api.post<ApiResponse<{ codigo: string; estado: string }>>(`/fondos-publico/postulacion/${codigo}/enviar`, {
      rut_postulante,
    })
    return response.data
  },

  subirAdjunto: async (codigo: string, rut_postulante: string, archivo: File, tipo_documento: string) => {
    const formData = new FormData()
    formData.append('rut_postulante', rut_postulante)
    formData.append('archivo', archivo)
    formData.append('tipo_documento', tipo_documento)
    const response = await api.post<ApiResponse<PostulacionAdjunto>>(
      `/fondos-publico/postulacion/${codigo}/adjunto`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return response.data
  },

  eliminarAdjunto: async (codigo: string, adjuntoId: number, rut_postulante: string) => {
    const response = await api.delete<ApiResponse<null>>(
      `/fondos-publico/postulacion/${codigo}/adjunto/${adjuntoId}`,
      { data: { rut_postulante } }
    )
    return response.data
  },

  consultar: async (codigo: string, rut: string) => {
    const response = await api.get<ApiResponse<PostulacionConsulta>>('/fondos-publico/consultar', {
      params: { codigo, rut },
    })
    return response.data
  },
}

// ============================
// API Admin (autenticada)
// ============================
export const fondosConcursablesAPI = {
  listar: async () => {
    const response = await api.get<ApiResponse<FondoConcursable[]>>('/fondos-concursables')
    return response.data
  },

  crear: async (data: Partial<FondoConcursable>) => {
    const response = await api.post<ApiResponse<FondoConcursable>>('/fondos-concursables', data)
    return response.data
  },

  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<FondoConcursable>>(`/fondos-concursables/${id}`)
    return response.data
  },

  actualizar: async (id: number, data: Partial<FondoConcursable>) => {
    const response = await api.put<ApiResponse<FondoConcursable>>(`/fondos-concursables/${id}`, data)
    return response.data
  },

  subirBases: async (id: number, archivo: File) => {
    const formData = new FormData()
    formData.append('archivo', archivo)
    const response = await api.post<ApiResponse<FondoConcursable>>(`/fondos-concursables/${id}/bases`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  postulaciones: async (fondoId: number, params?: { estado?: string; search?: string; page?: number; per_page?: number }) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Postulacion>>>(`/fondos-concursables/${fondoId}/postulaciones`, { params })
    return response.data
  },

  estadisticas: async (fondoId: number) => {
    const response = await api.get<ApiResponse<FondoEstadisticas>>(`/fondos-concursables/${fondoId}/estadisticas`)
    return response.data
  },
}

export const postulacionesAPI = {
  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<Postulacion>>(`/postulaciones/${id}`)
    return response.data
  },

  evaluar: async (id: number, data: {
    puntaje_detalle: Record<string, number>
    observaciones_evaluacion?: string
  }) => {
    const response = await api.post<ApiResponse<Postulacion>>(`/postulaciones/${id}/evaluar`, data)
    return response.data
  },

  aprobar: async (id: number, data: { monto_aprobado: number; observaciones_evaluacion?: string }) => {
    const response = await api.post<ApiResponse<Postulacion>>(`/postulaciones/${id}/aprobar`, data)
    return response.data
  },

  rechazar: async (id: number, data: { observaciones_evaluacion: string }) => {
    const response = await api.post<ApiResponse<Postulacion>>(`/postulaciones/${id}/rechazar`, data)
    return response.data
  },

  ficha: async (id: number) => {
    const response = await api.get<ApiResponse<Postulacion>>(`/postulaciones/${id}/ficha`)
    return response.data
  },

  descargarAdjunto: async (adjuntoId: number) => {
    const response = await api.get(`/postulacion-adjuntos/${adjuntoId}/descargar`, {
      responseType: 'blob',
    })
    return response.data
  },
}
