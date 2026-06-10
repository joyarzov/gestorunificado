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
  departamento_destino_id?: number
  usuario_destino_id?: number
  usuario_destino_ids?: number[]
  derivar_a_todos?: boolean
  observaciones?: string
  acciones_para?: string[]
  otp?: string
  firma_y?: number
  firma_page?: string
  firma_col?: number
  preview_token?: string
}

export interface PreviewDerivarData {
  correspondencia_id: number
  departamento_destino_id?: number
  usuario_destino_id?: number
  usuario_destino_ids?: number[]
  derivar_a_todos?: boolean
  observaciones?: string
  acciones_para?: string[]
}

export interface PreviewResult {
  blob: Blob
  token: string
}

export interface AlcaldeInfo {
  user_id: number
  nombre: string
  departamento_id: number
  departamento_nombre: string
}

export interface HiloAdjunto {
  id: number
  nombre: string
  tipo_mime?: string
  tamanio_bytes: number
}

export interface HiloItem {
  tipo: 'derivacion' | 'mensaje'
  id: number
  fecha: string
  // derivacion
  estado?: string
  de?: { usuario?: string | null; cargo?: string | null; departamento?: string | null }
  para?: { usuario?: string | null; cargo?: string | null; departamento?: string | null }
  actuando_como?: { nombre: string; cargo?: string | null } | null
  observaciones?: string | null
  acciones_para?: string[] | null
  tiene_pdf?: boolean
  // mensaje
  autor?: { id: number; nombre: string; cargo?: string | null }
  es_mio?: boolean
  mensaje?: string | null
  adjuntos?: HiloAdjunto[]
}

export interface BandejaResponse {
  items: Derivacion[]
  total: number
  page: number
  last_page: number
  per_page: number
  counts: { pendientes: number; recibidas: number }
}

export interface HiloResponse {
  items: HiloItem[]
  participantes: { id: number; nombre: string }[]
  puede_responder: boolean
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

  exportar: async (params?: CorrespondenciaFilters) => {
    const response = await api.get('/correspondencia/exportar', { params, responseType: 'blob' })
    return response.data as Blob
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

  derivacionesPendientes: async (params?: { tab?: 'pendientes' | 'recibidas'; page?: number; per_page?: number }) => {
    const response = await api.get<ApiResponse<BandejaResponse>>('/derivaciones/pendientes', { params })
    return response.data
  },

  recibirDerivacion: async (
    id: number,
    otp?: string,
    firmaY?: number,
    firmaPage?: string,
    firmaCol?: number,
    previewToken?: string,
  ) => {
    const response = await api.post<ApiResponse<Derivacion>>(
      `/derivaciones/${id}/recibir`,
      otp
        ? { otp, firma_y: firmaY, firma_page: firmaPage, firma_col: firmaCol, preview_token: previewToken }
        : {}
    )
    return response.data
  },

  // Previsualización de providencia (no persiste; cachea por 15 min con un token)
  previewDerivar: async (data: PreviewDerivarData): Promise<PreviewResult> => {
    const response = await api.post('/derivaciones/preview-derivar', data, {
      responseType: 'blob',
    })
    const token = (response.headers['x-preview-token'] || response.headers['X-Preview-Token']) as string
    return { blob: response.data as Blob, token }
  },

  previewRecibir: async (derivacionId: number): Promise<PreviewResult> => {
    const response = await api.post(`/derivaciones/${derivacionId}/preview-recibir`, null, {
      responseType: 'blob',
    })
    const token = (response.headers['x-preview-token'] || response.headers['X-Preview-Token']) as string
    return { blob: response.data as Blob, token }
  },

  descargarPdfDerivacion: async (derivacionId: number) => {
    const response = await api.get(`/derivaciones/${derivacionId}/pdf`, {
      responseType: 'blob',
    })
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

  // Hilo de conversación (timeline unificado: derivaciones + mensajes)
  obtenerHilo: async (correspondenciaId: number) => {
    const response = await api.get<ApiResponse<HiloResponse>>(`/correspondencia/${correspondenciaId}/hilo`)
    return response.data.data
  },

  enviarMensaje: async (correspondenciaId: number, mensaje: string, archivos: File[]) => {
    const formData = new FormData()
    if (mensaje) formData.append('mensaje', mensaje)
    archivos.forEach((f) => formData.append('adjuntos[]', f))
    const response = await api.post<ApiResponse<unknown>>(
      `/correspondencia/${correspondenciaId}/mensajes`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return response.data
  },

  descargarMensajeAdjunto: async (adjuntoId: number) => {
    const response = await api.get(`/correspondencia-mensajes/adjunto/${adjuntoId}/descargar`, {
      responseType: 'blob',
    })
    return response.data
  },
}
