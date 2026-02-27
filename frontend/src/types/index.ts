// Tipos de departamento
export interface Departamento {
  id: number
  nombre: string
  codigo?: string
  activo: boolean
}

// Tipos de usuario
export interface User {
  id: number
  rut: string
  nombre: string
  cargo?: string
  email?: string
  roles: string[]
  aplicaciones_permitidas?: string[]
  departamento_id?: number
  departamento?: Departamento
  visador: boolean
  activo: boolean
}

export interface AuthState {
  user: User | null
  selectedRole: string | null
  token: string | null
  loading: boolean
  showRoleSelector: boolean
}

// Tipos de correspondencia
export interface Correspondencia {
  id: number
  numero_documento?: string
  remitente: string
  fecha_documento?: string
  fecha_recibo: string
  descripcion?: string
  departamento_id?: number
  departamento?: Departamento
  usuario_id?: number
  usuario?: User
  estado: 'pendiente' | 'derivada_alcaldia' | 'en_proceso' | 'derivada_funcionario' | 'completada' | 'archivado'
  providencia_pdf?: string
  providencia_generada?: boolean
  adjuntos?: Adjunto[]
  derivaciones?: Derivacion[]
  created_at: string
  updated_at: string
}

export interface Adjunto {
  id: number
  nombre_archivo: string
  ruta_archivo: string
  tipo_mime?: string
  tamanio_bytes?: number
}

export interface Derivacion {
  id: number
  correspondencia_id: number
  departamento_origen_id: number
  departamento_destino_id: number
  departamento_origen?: Departamento
  departamento_destino?: Departamento
  usuario_origen_id: number
  usuario_destino_id?: number
  usuario_origen?: User
  usuario_destino?: User
  correspondencia?: Correspondencia
  pdf_ruta?: string
  observaciones?: string
  acciones_para?: string[]
  folio?: string
  estado: 'pendiente' | 'recibido' | 'archivado' | 'derivado'
  fecha_recepcion?: string
  created_at: string
}

// Tipos OIRS
export interface OirsSolicitud {
  id: number
  folio: string
  tipo_solicitud: 'consulta' | 'reclamo' | 'sugerencia' | 'felicitacion' | 'solicitud_informacion'
  nombre_solicitante: string
  rut_solicitante?: string
  email_solicitante: string
  telefono_solicitante?: string
  direccion_solicitante?: string
  comuna_solicitante: string
  anonimo: boolean
  categoria: string
  unidad_municipal?: string
  asunto: string
  descripcion: string
  fecha_hecho?: string
  lugar_hecho?: string
  medio_respuesta: 'email' | 'telefono' | 'carta_certificada' | 'presencial'
  estado: 'recibido' | 'asignada' | 'pendiente' | 'en_analisis' | 'derivado' | 'respondido' | 'cerrado'
  unidad_responsable_id?: number
  unidad_responsable?: Departamento
  funcionario_asignado_id?: number
  funcionario_asignado?: User
  prioridad: 'baja' | 'media' | 'alta'
  fecha_limite_respuesta?: string
  fecha_respuesta?: string
  respuesta?: string
  respuesta_funcionario?: string
  fecha_respuesta_funcionario?: string
  canal_ingreso: 'web' | 'presencial' | 'telefonico'
  adjuntos?: OirsAdjunto[]
  historial?: OirsHistorial[]
  created_at: string
  updated_at: string
}

export interface OirsAdjunto {
  id: number
  nombre_archivo: string
  ruta_archivo: string
  tipo_mime?: string
  tamanio_bytes?: number
  origen?: 'solicitante' | 'funcionario' | 'admin'
}

export interface OirsHistorial {
  id: number
  usuario_id: number
  usuario?: User
  accion: string
  estado_anterior?: string
  estado_nuevo?: string
  observaciones?: string
  created_at: string
}

// Tipos Gestor Documental
export interface TipoDocumental {
  id: number
  codigo: string
  nombre: string
  descripcion?: string
  requiere_firma: boolean
  genera_correlativo: boolean
  prefijo_correlativo?: string
  activo: boolean
}

export interface Expediente {
  id: number
  identificador?: string
  numero_expediente: string
  numero?: string
  titulo: string
  caratula?: string
  asunto?: string
  resumen?: string
  descripcion?: string
  tipo_documental_id?: number
  tipo_documental?: TipoDocumental
  departamento_id?: number
  departamento?: Departamento
  creado_por: number
  creador?: User
  estado: 'abierto' | 'cerrado' | 'archivado' | 'borrador' | 'en_tramite'
  nivel_acceso?: number
  informacion_sensible?: boolean
  cpat_codigo?: string
  cpat_nombre?: string
  fecha_cierre?: string
  fecha_creacion?: string
  metadata?: Record<string, unknown>
  documentos?: Documento[]
  actividades?: ExpedienteActividad[]
  created_at: string
  updated_at: string
}

export interface ExpedienteActividad {
  id: number
  expediente_id: number
  usuario_id: number
  usuario?: User
  tipo_actividad: string
  descripcion: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface DocumentoPlantilla {
  id: number
  nombre: string
  codigo: string
  descripcion?: string
  tipo_documental_id?: number
  tipo_documental?: TipoDocumental
  contenido_html: string
  variables_json: Record<string, string>
  activo: boolean
  requiere_firma: boolean
  requiere_aprobacion: boolean
  creado_por?: number
}

export interface Documento {
  id: number
  identificador: string
  codigo_verificacion?: string
  numero?: string
  titulo: string
  descripcion?: string
  tipo_documental_id?: number
  tipo_documental?: TipoDocumental
  plantilla_id?: number
  plantilla?: DocumentoPlantilla
  expediente_id?: number
  expediente?: Expediente
  expedientes?: Expediente[]
  creado_por: number
  creador?: User
  actualizado_por?: number
  departamento_id?: number
  contenido_json?: Record<string, string>
  contenido_html?: string
  archivo_pdf?: string
  archivo_original?: string
  formato?: string
  metadata_pdfa?: Record<string, unknown>
  estado: 'borrador' | 'pendiente_firma' | 'firmado' | 'rechazado' | 'anulado'
  nivel_acceso: number
  palabras_clave?: string
  firmado: boolean
  fecha_firma?: string
  firmante_asignado_id?: number
  firmante_asignado?: User
  firmantes_asignados?: User[]
  firmas_requeridas?: number
  completado: boolean
  fecha_creacion: string
  mecanismo_incorporacion: number
  orden_expediente?: number
  folio_inicio?: number
  folio_fin?: number
  anio: number
  firmas?: DocumentoFirma[]
  created_at: string
  updated_at: string
}

export interface DocumentoFirma {
  id: number
  documento_id: number
  firmante_id?: number
  usuario_id?: number
  usuario?: User
  nombre_cargo?: string
  run?: string
  orden_firma?: number
  tipo_firma?: string
  estado: 'pendiente' | 'firmado' | 'rechazado'
  fecha_firma?: string
  ip_firma?: string
  observacion?: string
  observaciones?: string
  es_simulada?: boolean
  metadata_firma?: Record<string, unknown>
}

// Trazabilidad de documentos
export interface DocumentoTrazabilidad {
  id: number
  documento_id: number
  usuario_id?: number
  usuario?: User
  accion: string
  descripcion: string
  metadata?: Record<string, unknown>
  created_at: string
}

// Envío de documentos
export interface DocumentoEnvio {
  id: number
  documento_id: number
  documento?: Documento
  remitente_id: number
  remitente?: User
  destinatario_id: number
  destinatario?: User
  estado: 'enviado' | 'completado'
  fecha_envio: string
  fecha_recepcion?: string
  observaciones?: string
  created_at: string
  updated_at: string
}

// Tipos de API
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

// Fondos Concursables
export interface FondoConcursable {
  id: number
  nombre: string
  codigo: string
  descripcion?: string
  bases_pdf_path?: string
  monto_total: number
  monto_maximo_por_proyecto: number
  estado: 'borrador' | 'abierto' | 'cerrado' | 'evaluacion' | 'finalizado'
  fecha_apertura?: string
  fecha_cierre?: string
  anio: number
  postulaciones_count?: number
  created_at: string
  updated_at: string
}

export interface PostulacionItemFinanciamiento {
  id?: number
  postulacion_id?: number
  sub_item: 'activo_fijo' | 'activo_intangible' | 'materia_prima' | 'mercaderia' | 'promocion' | 'transporte'
  producto_servicio: string
  justificacion?: string
  plazo_ejecucion?: string
  numero_cotizacion?: string
  proveedor?: string
  cantidad: number
  valor_unitario: number
  valor_total: number
  monto_municipio: number
  monto_cofinanciamiento: number
}

export interface PostulacionAdjunto {
  id: number
  postulacion_id: number
  tipo_documento: 'cedula_identidad' | 'registro_social_hogares' | 'cotizaciones' | 'resolucion_sanitaria' | 'patente_comercial' | 'carpeta_tributaria' | 'otro'
  nombre_archivo: string
  ruta_archivo: string
  tipo_mime?: string
  tamanio_bytes?: number
}

export interface Postulacion {
  id: number
  codigo: string
  fondo_id: number
  fondo?: FondoConcursable
  nombre_postulante: string
  rut_postulante: string
  email_postulante?: string
  telefono_postulante?: string
  contenido_json?: Record<string, unknown>
  estado: 'borrador' | 'enviada' | 'en_revision' | 'aprobada' | 'rechazada'
  puntaje?: number
  puntaje_detalle?: Record<string, number>
  observaciones_evaluacion?: string
  evaluado_por?: number
  evaluador?: User
  fecha_evaluacion?: string
  monto_aprobado?: number
  paso_actual: number
  items_financiamiento?: PostulacionItemFinanciamiento[]
  adjuntos?: PostulacionAdjunto[]
  created_at: string
  updated_at: string
}

export interface FondoEstadisticas {
  fondo: FondoConcursable
  total_postulaciones: number
  por_estado: Record<string, number>
  monto_total_aprobado: number
  puntaje_promedio: number | null
}

export interface PostulacionConsulta {
  codigo: string
  nombre_postulante: string
  estado: string
  puntaje?: number
  monto_aprobado?: number
  observaciones_evaluacion?: string
  created_at: string
  updated_at: string
  // Campos adicionales si es borrador
  contenido_json?: Record<string, unknown>
  items_financiamiento?: PostulacionItemFinanciamiento[]
  adjuntos?: PostulacionAdjunto[]
  paso_actual?: number
  fondo_id?: number
  email_postulante?: string
  telefono_postulante?: string
}

// Notificaciones
export interface Notificacion {
  id: number
  tipo: string
  titulo: string
  mensaje: string
  data?: Record<string, unknown>
  leida: boolean
  leida_at?: string
  created_at: string
}
