import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material'
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  UploadFile as UploadIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { correspondenciaAPI } from '../../api/correspondencia'
import { Adjunto } from '../../types'

const MAX_FILE_SIZE = 30 * 1024 * 1024 // 30 MB

const toYmdLocal = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const CorrespondenciaCreate = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [adjuntos, setAdjuntos] = useState<File[]>([])
  // En edición: adjuntos ya guardados (se suben/borran directo contra el backend).
  const [adjuntosExistentes, setAdjuntosExistentes] = useState<Adjunto[]>([])
  const [adjuntoSubiendo, setAdjuntoSubiendo] = useState(false)
  const [adjuntoError, setAdjuntoError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    numero_documento: '',
    remitente: '',
    fecha_documento: null as Date | null,
    fecha_recibo: new Date(),
    descripcion: '',
  })

  useEffect(() => {
    if (isEditMode && id) {
      loadCorrespondencia(parseInt(id))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadCorrespondencia = async (correspondenciaId: number) => {
    setLoadingData(true)
    try {
      const response = await correspondenciaAPI.obtener(correspondenciaId)
      const data = response.data
      setFormData({
        numero_documento: data.numero_documento || '',
        remitente: data.remitente || '',
        fecha_documento: data.fecha_documento ? new Date(data.fecha_documento) : null,
        fecha_recibo: data.fecha_recibo ? new Date(data.fecha_recibo) : new Date(),
        descripcion: data.descripcion || '',
      })
      setAdjuntosExistentes(data.adjuntos || [])
    } catch (err) {
      setError('Error al cargar la correspondencia')
      console.error(err)
    } finally {
      setLoadingData(false)
    }
  }

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdjuntoError('')
    const files = Array.from(e.target.files ?? [])
    // Reset el input para que se pueda volver a seleccionar el mismo archivo si se elimina.
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (files.length === 0) return

    const rechazados: string[] = []
    const aceptados: File[] = []
    for (const f of files) {
      if (f.type !== 'application/pdf') {
        rechazados.push(`${f.name}: solo PDF`)
        continue
      }
      if (f.size > MAX_FILE_SIZE) {
        rechazados.push(`${f.name}: supera 30 MB`)
        continue
      }
      aceptados.push(f)
    }
    if (rechazados.length) setAdjuntoError(rechazados.join(' · '))

    // En edición la correspondencia ya existe: se sube cada archivo al instante.
    if (isEditMode && id) {
      setAdjuntoSubiendo(true)
      for (const f of aceptados) {
        try {
          const res = await correspondenciaAPI.subirAdjunto(parseInt(id), f)
          setAdjuntosExistentes((prev) => [...prev, res.data])
        } catch (err) {
          console.error(`Error subiendo ${f.name}:`, err)
          setAdjuntoError(`No se pudo subir ${f.name}.`)
        }
      }
      setAdjuntoSubiendo(false)
    } else {
      setAdjuntos((prev) => [...prev, ...aceptados])
    }
  }

  const removeAdjunto = (index: number) => {
    setAdjuntos((prev) => prev.filter((_, i) => i !== index))
  }

  // En edición: borra un adjunto ya guardado directamente en el servidor.
  const handleBorrarExistente = async (adjId: number) => {
    setAdjuntoError('')
    try {
      await correspondenciaAPI.eliminarAdjunto(adjId)
      setAdjuntosExistentes((prev) => prev.filter((a) => a.id !== adjId))
    } catch (err) {
      console.error('Error al eliminar adjunto:', err)
      setAdjuntoError('No se pudo eliminar el adjunto.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // El ingreso siempre debe llevar el documento recibido adjunto.
    if (!isEditMode && adjuntos.length === 0) {
      setError('Debes adjuntar al menos un documento (PDF) antes de guardar el ingreso.')
      return
    }

    setLoading(true)

    try {
      const data = {
        ...formData,
        fecha_documento: formData.fecha_documento ? toYmdLocal(formData.fecha_documento) : undefined,
        fecha_recibo: formData.fecha_recibo ? toYmdLocal(formData.fecha_recibo) : toYmdLocal(new Date()),
      }

      if (isEditMode && id) {
        await correspondenciaAPI.actualizar(parseInt(id), data)
        navigate(`/correspondencia/${id}`)
      } else {
        const response = await correspondenciaAPI.crear(data)
        const correspondenciaId = response.data.id

        // Subir los adjuntos secuencialmente. Si alguno falla, registra el
        // nombre pero sigue con los demás (la correspondencia ya fue creada).
        const fallidos: string[] = []
        for (const file of adjuntos) {
          try {
            await correspondenciaAPI.subirAdjunto(correspondenciaId, file)
          } catch (err) {
            console.error(`Error subiendo adjunto ${file.name}:`, err)
            fallidos.push(file.name)
          }
        }

        if (fallidos.length) {
          setError(`Correspondencia creada, pero fallaron estos adjuntos: ${fallidos.join(', ')}`)
        }

        navigate(`/correspondencia/${correspondenciaId}`)
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || (isEditMode ? 'Error al actualizar correspondencia' : 'Error al crear correspondencia'))
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
          Volver
        </Button>
        <Typography variant="h4" fontWeight="bold">
          {isEditMode ? 'Editar Correspondencia' : 'Nueva Correspondencia'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Número de Documento"
                  value={formData.numero_documento}
                  onChange={(e) => handleChange('numero_documento', e.target.value)}
                  placeholder="Ej: OF-2024-001"
                  inputProps={{ maxLength: 100 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Remitente"
                  value={formData.remitente}
                  onChange={(e) => handleChange('remitente', e.target.value)}
                  placeholder="Nombre del remitente o institución"
                  inputProps={{ maxLength: 255 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Fecha del Documento"
                  value={formData.fecha_documento}
                  onChange={(date) => handleChange('fecha_documento', date)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Fecha de Recibo"
                  value={formData.fecha_recibo}
                  onChange={(date) => handleChange('fecha_recibo', date)}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Documentos adjuntos{!isEditMode && ' *'} (PDF, máx. {MAX_FILE_SIZE / (1024 * 1024)} MB c/u)
                  {!isEditMode && ' — obligatorio al menos uno'}
                </Typography>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={adjuntoSubiendo ? <CircularProgress size={16} /> : <UploadIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    size="small"
                    disabled={adjuntoSubiendo}
                  >
                    {isEditMode ? 'Subir PDF' : (adjuntos.length === 0 ? 'Seleccionar PDFs' : 'Agregar más')}
                  </Button>
                  {/* Edición: adjuntos ya guardados (se borran en el servidor) */}
                  {isEditMode && adjuntosExistentes.map((adj) => (
                    <Chip
                      key={adj.id}
                      label={adj.nombre_archivo}
                      onDelete={() => handleBorrarExistente(adj.id)}
                      size="small"
                    />
                  ))}
                  {/* Creación: adjuntos pendientes de subir */}
                  {!isEditMode && adjuntos.map((file, idx) => (
                    <Chip
                      key={`${file.name}-${idx}`}
                      label={file.name}
                      onDelete={() => removeAdjunto(idx)}
                      size="small"
                    />
                  ))}
                </Box>
                {adjuntoError && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                    {adjuntoError}
                  </Typography>
                )}
                {!isEditMode && adjuntos.length === 0 && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                    Debes adjuntar el documento recibido para poder guardar.
                  </Typography>
                )}
                {isEditMode && adjuntosExistentes.length === 0 && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                    Esta correspondencia no tiene adjuntos.
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Descripción / Asunto"
                  value={formData.descripcion}
                  onChange={(e) => handleChange('descripcion', e.target.value)}
                  placeholder="Breve descripción del contenido de la correspondencia"
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button variant="outlined" onClick={() => navigate(-1)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                    disabled={
                      loading
                      || !formData.remitente
                      || !formData.fecha_recibo
                      || (!isEditMode && adjuntos.length === 0)
                    }
                  >
                    {loading ? 'Guardando...' : (isEditMode ? 'Actualizar' : 'Guardar')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default CorrespondenciaCreate
