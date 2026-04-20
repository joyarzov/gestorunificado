import api from './axios'
import { ApiResponse } from '../types'

export interface OrganigramaIntegrante {
  id: number
  nombre: string
  cargo?: string | null
  email?: string | null
  es_jefe: boolean
}

export interface OrganigramaJefe {
  id: number
  nombre: string
  cargo?: string | null
  email?: string | null
  subrogante?: {
    id: number
    nombre: string
    cargo?: string | null
  } | null
}

export interface OrganigramaNodo {
  id: number
  nombre: string
  codigo?: string | null
  tipo?: string | null
  parent_id?: number | null
  orden: number
  jefe: OrganigramaJefe | null
  integrantes: OrganigramaIntegrante[]
}

export const organigramaAPI = {
  obtener: async () => {
    const response = await api.get<ApiResponse<OrganigramaNodo[]>>('/organigrama')
    return response.data
  },

  crearDepartamento: async (data: {
    nombre: string
    codigo?: string
    parent_id?: number | null
    tipo?: string
    jefe_id?: number | null
    orden?: number
  }) => {
    const response = await api.post<ApiResponse<OrganigramaNodo>>('/organigrama/departamentos', data)
    return response.data
  },

  actualizarDepartamento: async (
    departamentoId: number,
    data: { nombre?: string; codigo?: string | null; tipo?: string; activo?: boolean; orden?: number }
  ) => {
    const response = await api.patch<ApiResponse<OrganigramaNodo>>(
      `/organigrama/departamentos/${departamentoId}`,
      data
    )
    return response.data
  },

  actualizarParent: async (departamentoId: number, parentId: number | null) => {
    const response = await api.patch<ApiResponse<OrganigramaNodo>>(
      `/organigrama/departamentos/${departamentoId}/parent`,
      { parent_id: parentId }
    )
    return response.data
  },

  actualizarJefe: async (departamentoId: number, jefeId: number | null) => {
    const response = await api.patch<ApiResponse<OrganigramaNodo>>(
      `/organigrama/departamentos/${departamentoId}/jefe`,
      { jefe_id: jefeId }
    )
    return response.data
  },

  moverUsuario: async (userId: number, departamentoId: number | null) => {
    const response = await api.patch<ApiResponse<{ id: number; nombre: string; departamento_id: number | null }>>(
      `/organigrama/usuarios/${userId}/departamento`,
      { departamento_id: departamentoId }
    )
    return response.data
  },

  actualizarMiSubrogante: async (subroganteId: number | null) => {
    const response = await api.patch<ApiResponse<unknown>>('/organigrama/mi-subrogante', {
      subrogante_id: subroganteId,
    })
    return response.data
  },
}
