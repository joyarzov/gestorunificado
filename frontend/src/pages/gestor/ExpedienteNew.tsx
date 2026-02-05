import { useState, useEffect } from 'react'
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
  FormControl,
  InputLabel,
  Select,
} from '@mui/material'
import { Save as SaveIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { expedientesAPI } from '../../api/gestor'

const ExpedienteNew = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    titulo: '',
    asunto: '',
    resumen: '',
    nivel_acceso: 1,
    informacion_sensible: false,
    cpat_codigo: '',
  })

  useEffect(() => {
    if (isEdit && id) {
      cargarExpediente(parseInt(id))
    }
  }, [id, isEdit])

  const cargarExpediente = async (expId: number) => {
    setCargando(true)
    try {
      const response = await expedientesAPI.obtener(expId)
      const exp = response.data
      setFormData({
        titulo: exp.titulo || '',
        asunto: exp.asunto || '',
        resumen: exp.resumen || '',
        nivel_acceso: exp.nivel_acceso || 1,
        informacion_sensible: exp.informacion_sensible || false,
        cpat_codigo: exp.cpat_codigo || '',
      })
    } catch (err) {
      setError('Error al cargar el expediente')
    } finally {
      setCargando(false)
    }
  }

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isEdit && id) {
        await expedientesAPI.actualizar(parseInt(id), formData)
        navigate(`/expedientes/${id}`)
      } else {
        const response = await expedientesAPI.crear(formData)
        navigate(`/expedientes/${response.data.id}`)
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMsg = (err as any)?.response?.data?.message || 'Error al guardar'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  if (cargando) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
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
          {isEdit ? 'Editar Expediente' : 'Nuevo Expediente'}
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
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Título del Expediente"
                  value={formData.titulo}
                  onChange={(e) => handleChange('titulo', e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  multiline
                  rows={2}
                  label="Asunto"
                  value={formData.asunto}
                  onChange={(e) => handleChange('asunto', e.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Resumen"
                  value={formData.resumen}
                  onChange={(e) => handleChange('resumen', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Nivel de Acceso</InputLabel>
                  <Select
                    value={formData.nivel_acceso}
                    label="Nivel de Acceso"
                    onChange={(e) => handleChange('nivel_acceso', e.target.value)}
                  >
                    <MenuItem value={1}>Público</MenuItem>
                    <MenuItem value={2}>Restringido</MenuItem>
                    <MenuItem value={3}>Reservado</MenuItem>
                    <MenuItem value={4}>Secreto</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Código CPAT (opcional)"
                  value={formData.cpat_codigo}
                  onChange={(e) => handleChange('cpat_codigo', e.target.value)}
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
                    disabled={loading || !formData.titulo || !formData.asunto}
                  >
                    {loading ? (isEdit ? 'Actualizando...' : 'Creando...') : (isEdit ? 'Actualizar' : 'Crear Expediente')}
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

export default ExpedienteNew
