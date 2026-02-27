import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Divider,
  Slider,
  Chip,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import { postulacionesAPI } from '../../api/fondos'
import { Postulacion } from '../../types'

const CRITERIOS = [
  { key: 'claridad_coherencia', label: 'Claridad y Coherencia del Proyecto', peso: 25 },
  { key: 'impacto_economico', label: 'Impacto Económico Local', peso: 15 },
  { key: 'innovacion', label: 'Innovación', peso: 15 },
  { key: 'asociatividad', label: 'Asociatividad', peso: 5 },
  { key: 'sustentabilidad', label: 'Sustentabilidad del Proyecto', peso: 10 },
  { key: 'estrategia_comercial', label: 'Estrategia Comercial y Marketing', peso: 15 },
  { key: 'proveedores_locales', label: 'Proveedores Locales', peso: 10 },
  { key: 'participacion_charla', label: 'Participación en Charla', peso: 5 },
]

const MARKS = [
  { value: 0, label: '0' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 75, label: '75' },
  { value: 100, label: '100' },
]

const PostulacionEvaluar = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [postulacion, setPostulacion] = useState<Postulacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [puntajes, setPuntajes] = useState<Record<string, number>>({
    claridad_coherencia: 0,
    impacto_economico: 0,
    innovacion: 0,
    asociatividad: 0,
    sustentabilidad: 0,
    estrategia_comercial: 0,
    proveedores_locales: 0,
    participacion_charla: 0,
  })
  const [observaciones, setObservaciones] = useState('')

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await postulacionesAPI.obtener(parseInt(id || '0'))
        setPostulacion(res.data)
        // Pre-cargar puntajes existentes
        if (res.data.puntaje_detalle) {
          setPuntajes({ ...puntajes, ...res.data.puntaje_detalle })
        }
        if (res.data.observaciones_evaluacion) {
          setObservaciones(res.data.observaciones_evaluacion)
        }
      } catch {
        setError('Error al cargar la postulación')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const calcularPuntajeFinal = () => {
    let total = 0
    CRITERIOS.forEach((c) => {
      total += (puntajes[c.key] || 0) * (c.peso / 100)
    })
    return Math.round(total * 100) / 100
  }

  const handleGuardar = async () => {
    if (!postulacion) return
    setSaving(true)
    setError(null)
    try {
      await postulacionesAPI.evaluar(postulacion.id, {
        puntaje_detalle: puntajes,
        observaciones_evaluacion: observaciones,
      })
      setSuccess(true)
      setTimeout(() => navigate(`/postulaciones/${postulacion.id}`), 1500)
    } catch (err: unknown) {
      const errorData = (err as { response?: { data?: { message?: string } } })?.response?.data
      setError(errorData?.message || 'Error al guardar evaluación')
    } finally {
      setSaving(false)
    }
  }

  const puntajeFinal = calcularPuntajeFinal()

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }

  if (!postulacion) {
    return <Alert severity="error">Postulación no encontrada</Alert>
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(`/postulaciones/${postulacion.id}`)}>
          Volver al detalle
        </Button>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            Evaluar Postulación {postulacion.codigo}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {postulacion.nombre_postulante}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Evaluación guardada. Redirigiendo...</Alert>}

      {/* Puntaje final */}
      <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">Puntaje Final Ponderado</Typography>
        <Typography
          variant="h2"
          fontWeight="bold"
          color={puntajeFinal >= 80 ? 'success.main' : puntajeFinal >= 50 ? 'warning.main' : 'error.main'}
        >
          {puntajeFinal}%
        </Typography>
        <Chip
          label={puntajeFinal >= 80 ? 'Aprobado' : 'No aprobado'}
          color={puntajeFinal >= 80 ? 'success' : 'error'}
          sx={{ mt: 1 }}
        />
      </Paper>

      {/* Rúbrica */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Rúbrica de Evaluación
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Evalúe cada criterio en la escala: 0, 25, 50, 75 o 100 puntos.
        </Typography>

        {CRITERIOS.map((criterio, index) => (
          <Box key={criterio.key}>
            {index > 0 && <Divider sx={{ my: 2 }} />}
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={5}>
                <Typography variant="body1" fontWeight="medium">
                  {index + 1}. {criterio.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Peso: {criterio.peso}%
                </Typography>
              </Grid>
              <Grid item xs={12} sm={5}>
                <Slider
                  value={puntajes[criterio.key] || 0}
                  onChange={(_, value) => setPuntajes({ ...puntajes, [criterio.key]: value as number })}
                  step={25}
                  marks={MARKS}
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Typography variant="h6" fontWeight="bold" textAlign="center">
                  {puntajes[criterio.key] || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
                  Ponderado: {((puntajes[criterio.key] || 0) * criterio.peso / 100).toFixed(1)}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        ))}
      </Paper>

      {/* Observaciones */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Observaciones
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder="Ingrese observaciones sobre la evaluación..."
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </Paper>

      {/* Acciones */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={() => navigate(`/postulaciones/${postulacion.id}`)}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleGuardar}
          disabled={saving}
          size="large"
        >
          {saving ? 'Guardando...' : 'Guardar Evaluación'}
        </Button>
      </Box>
    </Box>
  )
}

export default PostulacionEvaluar
