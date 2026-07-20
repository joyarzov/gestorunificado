import api from './axios'
import {
  ApiResponse,
  Expediente,
  Documento,
  DocumentoAdjunto,
  DocumentoEnvio,
  DocumentoTrazabilidad,
  TipoDocumental,
  DocumentoPlantilla,
  PlantillaPersonal,
  PlantillaPersonalContenido,
  PaginatedResponse,
} from '../types'

export interface ExpedienteFilters {
  page?: number
  per_page?: number
  estado?: string
  departamento_id?: number
  search?: string
}

export interface DocumentoFilters {
  page?: number
  per_page?: number
  estado?: string
  tipo_documental_id?: number
  expediente_id?: number
  search?: string
  fecha_desde?: string
  fecha_hasta?: string
}

export interface CreateExpedienteData {
  titulo: string
  asunto: string
  resumen?: string
  nivel_acceso: number
  informacion_sensible?: boolean
  cpat_codigo?: string
  cpat_nombre?: string
}

export interface CreateDocumentoData {
  titulo: string
  plantilla_id: number
  expediente_id?: number
  expedientes_ids?: number[]
  tipo_documental_id?: number
  nivel_acceso: number
  contenido_json: Record<string, string>
  palabras_clave?: string
  firmante_asignado_id?: number
  firmantes_asignados?: number[]
  /** Calidad de cada firmante: { [firmante_id]: titular_id } cuando firma en subrogancia. */
  firmantes_subrogancia?: Record<number, number>
  firmas_requeridas?: number
  emitido_en_nombre_de_id?: number
}

export interface PreviewPlantillaData {
  plantilla_id: number
  contenido_json: Record<string, string>
}

export interface FirmaExternaDetectada {
  signer: string
  date: string | null
  valid: boolean
  raw: string
}

export interface AnalisisUpload {
  token: string
  nombre_original: string
  tamanio_bytes: number
  has_signatures: boolean
  signatures: FirmaExternaDetectada[]
  detector_error: string | null
}

export type AccionSubida = 'guardar_borrador' | 'cerrar_firmado' | 'firmar_propio' | 'enviar_firma'

export interface SubirDocumentoData {
  token: string
  titulo: string
  tipo_documental_id: number
  descripcion?: string
  palabras_clave?: string
  nivel_acceso: number
  expediente_id?: number
  firmas_externas?: FirmaExternaDetectada[]
  accion: AccionSubida
  firmantes_asignados?: number[]
  firmantes_subrogancia?: Record<number, number>
}

// API de Expedientes
export const expedientesAPI = {
  listar: async (params?: ExpedienteFilters) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Expediente>>>('/expedientes', { params })
    return response.data
  },

  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<Expediente>>(`/expedientes/${id}`)
    return response.data
  },

  crear: async (data: CreateExpedienteData) => {
    const response = await api.post<ApiResponse<Expediente>>('/expedientes', data)
    return response.data
  },

  actualizar: async (id: number, data: Partial<CreateExpedienteData>) => {
    const response = await api.put<ApiResponse<Expediente>>(`/expedientes/${id}`, data)
    return response.data
  },

  eliminar: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/expedientes/${id}`)
    return response.data
  },

  cerrar: async (id: number) => {
    const response = await api.post<ApiResponse<Expediente>>(`/expedientes/${id}/cerrar`)
    return response.data
  },

  reabrir: async (id: number) => {
    const response = await api.post<ApiResponse<Expediente>>(`/expedientes/${id}/reabrir`)
    return response.data
  },

  // Índice electrónico
  indiceElectronico: async (id: number) => {
    const response = await api.get<ApiResponse<{
      expediente: { numero: string; titulo: string; estado: string }
      documentos: Array<{
        orden: number
        numero_documento: string
        titulo: string
        tipo: string
        fecha: string
        folios: number
        firmado: boolean
      }>
      total_documentos: number
      total_folios: number
    }>>(`/expedientes/${id}/indice-electronico`)
    return response.data
  },

  actividades: async (id: number) => {
    const response = await api.get<ApiResponse<Array<{
      id: number
      tipo_actividad: string
      descripcion: string
      usuario?: { nombre: string }
      created_at: string
    }>>>(`/expedientes/${id}/actividades`)
    return response.data
  },

  misExpedientes: async (params?: ExpedienteFilters) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Expediente>>>('/expedientes/mis-expedientes', { params })
    return response.data
  },

  estadisticas: async () => {
    const response = await api.get<ApiResponse<{
      total: number
      abiertos: number
      cerrados: number
      por_tipo: Record<string, number>
      por_departamento: Record<string, number>
      creados_este_mes: number
    }>>('/expedientes/estadisticas')
    return response.data
  },

  asociarDocumento: async (expedienteId: number, documentoId: number) => {
    const response = await api.post<ApiResponse<Expediente>>(`/expedientes/${expedienteId}/asociar-documento`, {
      documento_id: documentoId,
    })
    return response.data
  },

  reordenarDocumentos: async (expedienteId: number, documentos: { id: number; orden: number }[]) => {
    const response = await api.put<ApiResponse<Expediente>>(`/expedientes/${expedienteId}/reordenar-documentos`, {
      documentos,
    })
    return response.data
  },

  subirDocumento: async (expedienteId: number, archivo: File, titulo: string, tipoDocumentalId: number) => {
    const formData = new FormData()
    formData.append('archivo', archivo)
    formData.append('titulo', titulo)
    formData.append('tipo_documental_id', String(tipoDocumentalId))
    const response = await api.post<ApiResponse<Expediente>>(`/expedientes/${expedienteId}/subir-documento`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Derivar el expediente a un funcionario responsable (el expediente circula con sus documentos)
  derivar: async (
    id: number,
    data: { usuario_destino_id: number; observaciones?: string; acciones_para?: string[] },
  ) => {
    const response = await api.post<ApiResponse<Expediente>>(`/expedientes/${id}/derivar`, data)
    return response.data
  },

  // Recibir la derivación pendiente de un expediente dirigido al usuario
  recibir: async (id: number) => {
    const response = await api.post<ApiResponse<Expediente>>(`/expedientes/${id}/recibir`)
    return response.data
  },

  // Bandeja de expedientes que le llegaron al usuario por derivación
  bandeja: async (estado: 'pendiente' | 'recibido' = 'pendiente') => {
    const response = await api.get<ApiResponse<Expediente[]>>('/expedientes/bandeja', { params: { estado } })
    return response.data
  },

  // Hoja de ruta consolidada (actividades + firmas) del expediente
  hojaRuta: async (id: number) => {
    const response = await api.get<ApiResponse<Array<{
      fuente: string
      tipo: string
      descripcion: string
      usuario: string
      fecha: string
    }>>>(`/expedientes/${id}/hoja-ruta`)
    return response.data
  },
}

// API de Documentos
export const documentosAPI = {
  listar: async (params?: DocumentoFilters) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Documento>>>('/documentos', { params })
    return response.data
  },

  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<Documento>>(`/documentos/${id}`)
    return response.data
  },

  crear: async (data: CreateDocumentoData) => {
    const response = await api.post<ApiResponse<Documento>>('/documentos', data)
    return response.data
  },

  // Obtener plantillas activas
  getPlantillas: async () => {
    const response = await api.get<DocumentoPlantilla[]>('/documentos/plantillas')
    return response.data
  },

  // Previsualizar plantilla con variables.
  // `full` indica que `html` es un documento HTML completo (motor por bloques, Fase 2).
  previsualizar: async (data: PreviewPlantillaData) => {
    const response = await api.post<{ html: string; full?: boolean }>('/documentos/previsualizar', data)
    return response.data
  },

  // Obtener próximo correlativo
  proximoCorrelativo: async (tipoDocumentalId: number) => {
    const response = await api.get<ApiResponse<{
      proximo_numero: number
      proximo_formateado: string
      tipo_documental: TipoDocumental
    }>>('/documentos/proximo-correlativo', {
      params: { tipo_documental_id: tipoDocumentalId }
    })
    return response.data
  },

  // Enviar a firma
  enviarAFirma: async (id: number) => {
    const response = await api.post<ApiResponse<Documento>>(`/documentos/${id}/enviar-firma`)
    return response.data
  },

  actualizar: async (id: number, data: Partial<Omit<CreateDocumentoData, 'archivo' | 'expediente_id'>>) => {
    const response = await api.put<ApiResponse<Documento>>(`/documentos/${id}`, data)
    return response.data
  },

  eliminar: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/documentos/${id}`)
    return response.data
  },

  descargar: async (id: number) => {
    const response = await api.get(`/documentos/${id}/descargar`, {
      responseType: 'blob',
    })
    return response.data
  },

  pendientesFirma: async (params?: DocumentoFilters) => {
    const response = await api.get<ApiResponse<PaginatedResponse<Documento>>>('/documentos/pendientes-firma', {
      params,
    })
    return response.data
  },

  // Titulares en cuyo nombre el usuario puede emitir documentos (delegación de emisión).
  emisoresDelegados: async () => {
    const response = await api.get<ApiResponse<{ id: number; nombre: string; cargo: string | null }[]>>(
      '/documentos/emisores-delegados',
    )
    return response.data
  },

  firmar: async (id: number, observaciones?: string, otp?: string, firmaY?: number, firmaPage?: string, firmaCol?: number, desatendida?: boolean) => {
    const response = await api.post<ApiResponse<Documento>>(`/documentos/${id}/firmar`, {
      observaciones,
      otp,
      firma_desatendida: desatendida,
      firma_y: firmaY,
      firma_page: firmaPage,
      firma_col: firmaCol,
    })
    return response.data
  },

  firmaConfig: async () => {
    const response = await api.get<ApiResponse<{ firma_gob_enabled: boolean; firma_gob_purpose: string }>>('/documentos/firma-config')
    return response.data
  },

  rechazarFirma: async (id: number, motivo: string) => {
    const response = await api.post<ApiResponse<Documento>>(`/documentos/${id}/rechazar-firma`, {
      motivo,
    })
    return response.data
  },

  // Devuelve un documento rechazado a borrador para corregirlo y reenviarlo.
  devolverABorrador: async (id: number) => {
    const response = await api.post<ApiResponse<Documento>>(`/documentos/${id}/devolver-a-borrador`)
    return response.data
  },

  agregarFirmante: async (id: number, usuarioId: number) => {
    const response = await api.post<ApiResponse<{ id: number }>>(`/documentos/${id}/agregar-firmante`, {
      usuario_id: usuarioId,
    })
    return response.data
  },

  estadisticas: async () => {
    const response = await api.get<ApiResponse<{
      total: number
      por_estado: Record<string, number>
      por_tipo: Record<string, number>
      creados_este_mes: number
    }>>('/documentos/estadisticas')
    return response.data
  },

  // Enviar documento firmado a destinatario(s)
  enviarDocumento: async (id: number, destinatarioIds?: number[]) => {
    const data = destinatarioIds ? { destinatario_ids: destinatarioIds } : {}
    const response = await api.post<ApiResponse<DocumentoEnvio | DocumentoEnvio[]>>(`/documentos/${id}/enviar`, data)
    return response.data
  },

  // Obtener envíos de un documento
  enviosDocumento: async (id: number) => {
    const response = await api.get<ApiResponse<DocumentoEnvio[]>>(`/documentos/${id}/envios`)
    return response.data
  },

  // Obtener trazabilidad de un documento
  trazabilidad: async (id: number) => {
    const response = await api.get<ApiResponse<DocumentoTrazabilidad[]>>(`/documentos/${id}/trazabilidad`)
    return response.data
  },

  // Actualizar solo metadatos (título, tipo, nivel) — para documentos subidos/externos
  actualizarMetadatos: async (id: number, data: { titulo?: string; tipo_documental_id?: number | null; nivel_acceso?: number }) => {
    const response = await api.put<ApiResponse<Documento>>(`/documentos/${id}/metadatos`, data)
    return response.data
  },

  // Analizar PDF subido (detección de firmas)
  analizarUpload: async (archivo: File) => {
    const formData = new FormData()
    formData.append('archivo', archivo)
    const response = await api.post<ApiResponse<AnalisisUpload>>('/documentos/upload/analizar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  // Crear documento desde PDF subido
  subirDocumento: async (data: SubirDocumentoData) => {
    const response = await api.post<ApiResponse<Documento>>('/documentos/upload/subir', data)
    return response.data
  },

  // --- Adjuntos PDF de un documento ---
  subirAdjunto: async (documentoId: number, archivo: File) => {
    const formData = new FormData()
    formData.append('archivo', archivo)
    const response = await api.post<ApiResponse<DocumentoAdjunto>>(
      `/adjuntos/documento/${documentoId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return response.data
  },

  eliminarAdjunto: async (adjuntoId: number) => {
    const response = await api.delete<ApiResponse<null>>(`/adjuntos/documento-adjunto/${adjuntoId}`)
    return response.data
  },

  descargarAdjunto: async (adjuntoId: number) => {
    const response = await api.get(`/adjuntos/documento-adjunto/${adjuntoId}/descargar`, {
      responseType: 'blob',
    })
    return response.data
  },

  // --- Plantillas personales (presets por usuario) ---
  getMisPlantillas: async () => {
    const response = await api.get<PlantillaPersonal[]>('/documentos/mis-plantillas')
    return response.data
  },

  guardarPlantillaPersonal: async (data: {
    nombre: string
    plantilla_id: number
    contenido_json: PlantillaPersonalContenido
  }) => {
    const response = await api.post<ApiResponse<PlantillaPersonal>>('/documentos/mis-plantillas', data)
    return response.data
  },

  eliminarPlantillaPersonal: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/documentos/mis-plantillas/${id}`)
    return response.data
  },
}

// API de Envíos de Documentos
export const documentoEnviosAPI = {
  recibidos: async (params?: { estado?: string; page?: number; per_page?: number }) => {
    const response = await api.get<ApiResponse<PaginatedResponse<DocumentoEnvio>>>('/documento-envios/recibidos', { params })
    return response.data
  },

  enviados: async (params?: { estado?: string; page?: number; per_page?: number }) => {
    const response = await api.get<ApiResponse<PaginatedResponse<DocumentoEnvio>>>('/documento-envios/enviados', { params })
    return response.data
  },

  acusarRecibo: async (envioId: number) => {
    const response = await api.post<ApiResponse<DocumentoEnvio>>(`/documento-envios/${envioId}/acusar-recibo`)
    return response.data
  },
}

// API de Tipos documentales
export const tiposDocumentalesAPI = {
  listar: async () => {
    const response = await api.get<ApiResponse<TipoDocumental[]>>('/tipos-documentales')
    return response.data
  },

  obtener: async (id: number) => {
    const response = await api.get<ApiResponse<TipoDocumental>>(`/tipos-documentales/${id}`)
    return response.data
  },

  crear: async (data: Partial<TipoDocumental>) => {
    const response = await api.post<ApiResponse<TipoDocumental>>('/tipos-documentales', data)
    return response.data
  },

  actualizar: async (id: number, data: Partial<TipoDocumental>) => {
    const response = await api.put<ApiResponse<TipoDocumental>>(`/tipos-documentales/${id}`, data)
    return response.data
  },
}

// API de Correlativos
export const correlativosAPI = {
  listar: async () => {
    const response = await api.get<ApiResponse<Array<{
      id: number
      tipo: string
      prefijo?: string
      valor_actual: number
      anio: number
    }>>>('/correlativos')
    return response.data
  },

  obtener: async (tipo: string) => {
    const response = await api.get<ApiResponse<{
      id: number
      tipo: string
      prefijo?: string
      valor_actual: number
      anio: number
    }>>(`/correlativos/${tipo}`)
    return response.data
  },

  siguiente: async (tipo: string) => {
    const response = await api.get<ApiResponse<{ tipo: string; siguiente: number }>>(`/correlativos/${tipo}/siguiente`)
    return response.data
  },

  reset: async (tipo: string, valor: number) => {
    const response = await api.post<ApiResponse<null>>(`/correlativos/${tipo}/reset`, { valor })
    return response.data
  },

  crear: async (data: { tipo: string; prefijo?: string; valor_inicial?: number; reinicio_anual?: boolean }) => {
    const response = await api.post<ApiResponse<{ id: number }>>('/correlativos', data)
    return response.data
  },
}
