// Tipos de departamento
export interface Departamento {
  id: number
  nombre: string
  codigo?: string
  activo: boolean
}

export interface SubrogadoActivo {
  id: number
  nombre: string
  cargo?: string | null
  roles: string[]
  departamento_id?: number | null
  subrogancia_hasta?: string | null
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
  subrogante_id?: number | null
  subrogante?: { id: number; nombre: string; cargo?: string | null } | null
  subrogancia_activa?: boolean
  subrogancia_desde?: string | null
  subrogancia_hasta?: string | null
  subrogados_activos?: SubrogadoActivo[]
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
export type CorrespondenciaEstado =
  // ciclo de entrada
  | 'pendiente' | 'derivada_alcaldia' | 'en_proceso' | 'derivada_funcionario' | 'completada' | 'archivado'
  // ciclo de salida
  | 'reservada' | 'por_despachar' | 'despachada' | 'devuelta' | 'anulada'

export type TipoDocumentoSalida = 'oficio' | 'ordinario' | 'circular' | 'carta'

export interface Correspondencia {
  id: number
  folio?: string
  direccion?: 'entrada' | 'salida'
  numero_documento?: string
  tipo_documento_salida?: TipoDocumentoSalida
  remitente: string
  fecha_documento?: string
  fecha_recibo: string
  descripcion?: string
  departamento_id?: number
  departamento?: Departamento
  usuario_id?: number
  usuario?: User
  estado: CorrespondenciaEstado
  providencia_pdf?: string
  providencia_generada?: boolean
  adjuntos?: Adjunto[]
  derivaciones?: Derivacion[]
  // salida
  respuesta_a_id?: number | null
  respuesta_a?: { id: number; folio?: string; remitente: string } | null
  respuestas?: Correspondencia[]
  documento_nombre?: string | null
  firmante_nombre?: string | null
  medio_despacho?: string | null
  fecha_despacho?: string | null
  referencia_despacho?: string | null
  despachada_por_user?: { id: number; nombre: string } | null
  motivo_devolucion?: string | null
  // entrada
  respondida_at?: string | null
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
  actuando_como_user_id?: number | null
  actuando_como?: { id: number; nombre: string; cargo?: string | null } | null
  correspondencia?: Correspondencia
  pdf_ruta?: string
  observaciones?: string
  acciones_para?: string[]
  folio?: string
  estado: 'pendiente' | 'recibido' | 'archivado' | 'derivado'
  fecha_recepcion?: string
  created_at: string
  // Solo en la bandeja: si el usuario puede actuar (recibir/archivar) o solo ver
  puede_actuar?: boolean
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

// Render por bloques (Fase 2)
export interface BloquePlantilla {
  tipo: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props?: Record<string, any>
}

export interface EstiloPlantilla {
  fuente_tamano?: string
  regla_azul?: boolean
  membrete?: { color?: string; institucion?: string; subtitulo?: string; mostrar?: boolean }
  logo?: { mostrar?: boolean; max_ancho?: string }
  barra_colores?: { mostrar?: boolean; colores?: string[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
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
  // Metadatos del mantenedor (Fase 1)
  editable_admin?: boolean
  orden?: number | null
  origen?: 'seeder' | 'admin'
  creado_por?: number
  creador?: { id: number; nombre: string }
  documentos_count?: number
  plantillas_personales_count?: number
  // Render por bloques (Fase 2)
  render_engine?: 'html_legacy' | 'bloques'
  estructura_json?: BloquePlantilla[] | null
  estilo_json?: EstiloPlantilla | null
}

export interface DocumentoAdjunto {
  id: number
  documento_id: number
  nombre_archivo: string
  ruta_archivo: string
  tipo_mime?: string
  tamanio_bytes?: number
  subido_por?: number
  usuario?: { id: number; nombre: string }
  created_at: string
}

export interface PlantillaPersonalContenido {
  variables?: Record<string, string>
  articulos?: { id: string; contenido: string }[]
  distribucion?: { id: number; nombre: string }[]
  firmantes_ids?: number[]
  field_alignments?: Record<string, string>
}

export interface PlantillaPersonal {
  id: number
  user_id: number
  nombre: string
  plantilla_id: number
  plantilla_base?: DocumentoPlantilla
  contenido_json: PlantillaPersonalContenido
  created_at: string
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
  adjuntos?: DocumentoAdjunto[]
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
  firma_gob_id?: string
  firma_gob_data?: Record<string, unknown>
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
  activo: boolean
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

// Sello de Firma
export interface FirmaSello {
  id: number
  nombre: string
  logo_path?: string
  color_primario: string
  color_secundario: string
  color_fondo: string
  fondo_opacidad: number
  mostrar_logo: boolean
  nombre_institucion: string
  texto_linea1: string
  texto_linea2: string
  activo: boolean
  preview_path?: string
  creado_por?: number
  creador?: { id: number; nombre: string }
  created_at: string
  updated_at: string
}

// Notificaciones
export interface Notificacion {
  id: number
  modulo?: string
  tipo: string
  titulo: string
  mensaje: string
  data?: Record<string, unknown>
  leida: boolean
  leida_at?: string
  email_enviado_at?: string
  created_at: string
}
