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
  MenuItem,
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
import { departamentosAPI } from '../../api/common'
import { Departamento } from '../../types'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const CorrespondenciaCreate = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [adjuntos, setAdjuntos] = useState<File[]>([])
  const [adjuntoError, setAdjuntoError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    numero_documento: '',
    remitente: '',
    fecha_documento: null as Date | null,
    fecha_recibo: new Date(),
    descripcion: '',
    departamento_id: '',
  })

  useEffect(() => {
    loadDepartamentos()
    if (isEditMode && id) {
      loadCorrespondencia(parseInt(id))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadDepartamentos = async () => {
    try {
      const response = await departamentosAPI.listar()
      setDepartamentos(response.data)
    } catch (error) {
      console.error('Error cargando departamentos:', error)
    }
  }

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
        departamento_id: data.departamento_id ? String(data.departamento_id) : '',
      })
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdjuntoError('')
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const rechazados: string[] = []
    const aceptados: File[] = []
    for (const f of files) {
      if (f.type !== 'application/pdf') {
        rechazados.push(`${f.name}: solo PDF`)
        continue
      }
      if (f.size > MAX_FILE_SIZE) {
        rechazados.push(`${f.name}: supera 10 MB`)
        continue
      }
      aceptados.push(f)
    }

    setAdjuntos((prev) => [...prev, ...aceptados])
    if (rechazados.length) {
      setAdjuntoError(rechazados.join(' · '))
    }
    // Reset el input para que se pueda volver a seleccionar el mismo archivo si se elimina.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAdjunto = (index: number) => {
    setAdjuntos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = {
        ...formData,
        fecha_documento: formData.fecha_documento?.toISOString().split('T')[0],
        fecha_recibo: formData.fecha_recibo?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        departamento_id: formData.departamento_id ? Number(formData.departamento_id) : undefined,
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
                <TextField
                  fullWidth
                  select
                  label="Departamento Destino"
                  value={formData.departamento_id}
                  onChange={(e) => handleChange('departamento_id', e.target.value)}
                >
                  <MenuItem value="">Sin asignar</MenuItem>
                  {departamentos.map((depto) => (
                    <MenuItem key={depto.id} value={depto.id}>
                      {depto.nombre}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {!isEditMode && (
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Documentos adjuntos (PDF, máx. 10 MB c/u)
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
                      startIcon={<UploadIcon />}
                      onClick={() => fileInputRef.current?.click()}
                      size="small"
                    >
                      {adjuntos.length === 0 ? 'Seleccionar PDFs' : 'Agregar más'}
                    </Button>
                    {adjuntos.map((file, idx) => (
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
                </Grid>
              )}

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
                    disabled={loading || !formData.remitente}
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
