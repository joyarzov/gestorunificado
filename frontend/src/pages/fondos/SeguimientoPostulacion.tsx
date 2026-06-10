import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material'
import {
  Search as SearchIcon,
  Home as HomeIcon,
} from '@mui/icons-material'
import { fondosPublicoAPI } from '../../api/fondos'
import { PostulacionConsulta } from '../../types'

const estadoConfig: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }> = {
  borrador: { label: 'Borrador', color: 'default' },
  enviada: { label: 'Enviada', color: 'info' },
  en_revision: { label: 'En Revisión', color: 'warning' },
  aprobada: { label: 'Aprobada', color: 'success' },
  rechazada: { label: 'Rechazada', color: 'error' },
}

const SeguimientoPostulacion = () => {
  const navigate = useNavigate()
  const [codigo, setCodigo] = useState('')
  const [rut, setRut] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<PostulacionConsulta | null>(null)

  const handleConsultar = async () => {
    if (!codigo.trim() || !rut.trim()) {
      setError('Ingrese el código de postulación y su RUT')
      return
    }

    setLoading(true)
    setError(null)
    setResultado(null)

    try {
      const res = await fondosPublicoAPI.consultar(codigo.trim(), rut.trim())
      setResultado(res.data)
    } catch (err: unknown) {
      const errorData = (err as { response?: { data?: { message?: string } } })?.response?.data
      setError(errorData?.message || 'Postulación no encontrada')
    } finally {
      setLoading(false)
    }
  }

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monto)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#0071BC', color: 'white', py: 3 }}>
        <Container maxWidth="sm">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              component="img"
              src="/logo_blanco.png"
              alt="Municipalidad"
              sx={{ height: 48, width: 'auto' }}
            />
            <Box>
              <Typography variant="h5" fontWeight="bold">
                Seguimiento de Postulación
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Tu Negocio Crece
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="body1" gutterBottom>
            Ingrese su código de postulación y RUT para consultar el estado.
          </Typography>

          <TextField
            fullWidth
            label="Código de Postulación"
            placeholder="TNC-XXXXXX"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            sx={{ mb: 2, mt: 2 }}
          />
          <TextField
            fullWidth
            label="RUT del Postulante"
            placeholder="12345678-9"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            sx={{ mb: 2 }}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleConsultar}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
            disabled={loading}
            sx={{ mb: 2 }}
          >
            {loading ? 'Consultando...' : 'Consultar'}
          </Button>

          {resultado && (
            <>
              <Divider sx={{ my: 3 }} />
              <Box>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Resultado
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Código:</Typography>
                    <Typography variant="body1" fontWeight="bold" sx={{ fontFamily: 'monospace' }}>
                      {resultado.codigo}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Postulante:</Typography>
                    <Typography variant="body1">{resultado.nombre_postulante}</Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Estado:</Typography>
                    <Chip
                      label={estadoConfig[resultado.estado]?.label || resultado.estado}
                      color={estadoConfig[resultado.estado]?.color || 'default'}
                      size="small"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Fecha de envío:</Typography>
                    <Typography variant="body2">
                      {new Date(resultado.created_at).toLocaleDateString('es-CL')}
                    </Typography>
                  </Box>

                  {resultado.puntaje != null && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Puntaje:</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {resultado.puntaje} / 100
                      </Typography>
                    </Box>
                  )}

                  {resultado.monto_aprobado != null && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Monto Aprobado:</Typography>
                      <Typography variant="body1" fontWeight="bold" color="success.main">
                        {formatMonto(resultado.monto_aprobado)}
                      </Typography>
                    </Box>
                  )}

                  {resultado.observaciones_evaluacion && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Observaciones:
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="body2">{resultado.observaciones_evaluacion}</Typography>
                      </Paper>
                    </Box>
                  )}

                  {resultado.estado === 'borrador' && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Su postulación está en borrador. Puede continuar completándola.
                      <Button
                        size="small"
                        sx={{ ml: 1 }}
                        onClick={() => navigate(`/fondos/postular/${resultado.codigo}`)}
                      >
                        Continuar
                      </Button>
                    </Alert>
                  )}
                </Box>
              </Box>
            </>
          )}
        </Paper>

        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Button
            startIcon={<HomeIcon />}
            onClick={() => navigate('/portal-ciudadano')}
          >
            Volver al Inicio
          </Button>
        </Box>
      </Container>
    </Box>
  )
}

export default SeguimientoPostulacion
