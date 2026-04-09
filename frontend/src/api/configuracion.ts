import api from './axios'
import { ApiResponse } from '../types'

export interface ConfiguracionItem {
  clave: string
  valor: string
  descripcion: string | null
}

export interface FirmagobEstado {
  simulate: boolean
  enabled: boolean
}

export const configuracionAPI = {
  listar: async () => {
    const res = await api.get<ApiResponse<Record<string, ConfiguracionItem>>>('/configuracion')
    return res.data
  },

  actualizar: async (clave: string, valor: string) => {
    const res = await api.patch<ApiResponse<ConfiguracionItem>>(`/configuracion/${clave}`, { valor })
    return res.data
  },

  firmagobEstado: async () => {
    const res = await api.get<ApiResponse<FirmagobEstado>>('/firmagob/estado')
    return res.data
  },
}
