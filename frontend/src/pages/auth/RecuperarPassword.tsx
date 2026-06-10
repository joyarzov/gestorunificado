import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material'
import { LockReset as ResetIcon } from '@mui/icons-material'
import { authAPI } from '../../api/auth'
import CorporateColorBar from '../../components/branding/CorporateColorBar'

const RecuperarPassword = () => {
  const [rut, setRut] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const formatRut = (value: string) => {
    let cleaned = value.replace(/[^0-9kK]/g, '')
    if (cleaned.length > 9) cleaned = cleaned.slice(0, 9)
    if (cleaned.length > 1) {
      return `${cleaned.slice(0, -1)}-${cleaned.slice(-1).toUpperCase()}`
    }
    return cleaned
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authAPI.forgotPassword(rut)
      setEnviado(true)
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'No se pudo procesar la solicitud. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#0071BC',
        p: 2,
        gap: 3,
      }}
    >
      <Box
        component="img"
        src="/logo_blanco.png"
        alt="Municipalidad de Cabo de Hornos"
        sx={{ height: 80, width: 'auto' }}
      />

      <Card sx={{ maxWidth: 400, width: '100%', overflow: 'hidden' }}>
        <CorporateColorBar height={5} />
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold" color="primary">
              Recuperar contraseña
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ingresa tu RUT y te enviaremos un enlace a tu correo institucional
            </Typography>
          </Box>

          {enviado ? (
            <>
              <Alert severity="success" sx={{ mb: 3 }}>
                Si el RUT corresponde a un usuario con correo registrado, recibirás un
                enlace para restablecer tu contraseña. Revisa tu bandeja de entrada
                (y la carpeta de spam). El enlace es válido por 60 minutos.
              </Alert>
              <Button fullWidth variant="contained" onClick={() => navigate('/login')}>
                Volver al inicio de sesión
              </Button>
            </>
          ) : (
            <Box component="form" onSubmit={handleSubmit}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <TextField
                fullWidth
                label="RUT"
                value={rut}
                onChange={(e) => setRut(formatRut(e.target.value))}
                placeholder="12345678-9"
                sx={{ mb: 3 }}
                disabled={loading}
                autoComplete="username"
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || !rut}
                startIcon={loading ? <CircularProgress size={20} /> : <ResetIcon />}
              >
                {loading ? 'Enviando…' : 'Enviar enlace'}
              </Button>
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Button variant="text" size="small" onClick={() => navigate('/login')}>
                  Volver al inicio de sesión
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default RecuperarPassword
