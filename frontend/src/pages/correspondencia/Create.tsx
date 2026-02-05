import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from '@mui/material'
import { Save as SaveIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { correspondenciaAPI } from '../../api/correspondencia'
import { departamentosAPI } from '../../api/common'
import { Departamento } from '../../types'

const CorrespondenciaCreate = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])

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
  }, [])

  const loadDepartamentos = async () => {
    try {
      const response = await departamentosAPI.listar()
      setDepartamentos(response.data)
    } catch (error) {
      console.error('Error cargando departamentos:', error)
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
      const data = {
        ...formData,
        fecha_documento: formData.fecha_documento?.toISOString().split('T')[0],
        fecha_recibo: formData.fecha_recibo?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        departamento_id: formData.departamento_id ? Number(formData.departamento_id) : undefined,
      }

      const response = await correspondenciaAPI.crear(data)
      navigate(`/correspondencia/${response.data.id}`)
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'Error al crear correspondencia')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
          Volver
        </Button>
        <Typography variant="h4" fontWeight="bold">
          Nueva Correspondencia
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
                    {loading ? 'Guardando...' : 'Guardar'}
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
