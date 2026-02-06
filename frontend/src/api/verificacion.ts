import api from './axios'
import { ApiResponse } from '../types'

export interface DocumentoVerificado {
  tipo_origen: 'documento' | 'providencia'
  codigo: string
  // Documento fields
  identificador?: string
  numero?: string
  titulo?: string
  tipo_documental?: string
  estado?: string
  firmado?: boolean
  fecha_creacion?: string
  fecha_firma?: string
  firmantes?: Array<{ nombre: string; fecha_firma?: string }>
  anio?: number
  // Providencia fields
  folio?: string
  fecha?: string
  remitente?: string
  departamento_destino?: string
  acciones?: string[]
  usuario_origen?: string
}

export const verificacionAPI = {
  verificar: async (codigo: string) => {
    const response = await api.get<ApiResponse<DocumentoVerificado>>(`/verificar-documento/${codigo}`)
    return response.data
  },
}
