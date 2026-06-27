import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material'
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material'
import { useAuth } from '../../contexts/AuthContext'
import CorporateColorBar from '../../components/branding/CorporateColorBar'

const Login = () => {
  const [rut, setRut] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Confirmación cuando ya hay otra sesión propia activa (backend devuelve 409).
  const [confirmReuso, setConfirmReuso] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/portal'

  const formatRut = (value: string) => {
    // Eliminar todo excepto números y k/K
    let cleaned = value.replace(/[^0-9kK]/g, '')

    // Limitar a 9 caracteres
    if (cleaned.length > 9) {
      cleaned = cleaned.slice(0, 9)
    }

    // Agregar guión antes del dígito verificador
    if (cleaned.length > 1) {
      const dv = cleaned.slice(-1)
      const body = cleaned.slice(0, -1)
      return `${body}-${dv.toUpperCase()}`
    }

    return cleaned
  }

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRut(formatRut(e.target.value))
  }

  const intentarLogin = async (forzar: boolean) => {
    setError('')
    setLoading(true)
    try {
      await login(rut, password, forzar)
      navigate(from, { replace: true })
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = (err as any)?.response
      // 409 = ya hay otra sesión propia activa → pedir confirmación antes de cerrarla.
      if (response?.status === 409) {
        setConfirmMsg(response?.data?.message || 'Ya hay una sesión activa de este usuario.')
        setConfirmReuso(true)
      } else {
        setError(response?.data?.message || 'Error al iniciar sesión')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await intentarLogin(false)
  }

  const handleConfirmReuso = async () => {
    setConfirmReuso(false)
    await intentarLogin(true)
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
      {/* Logo blanco sobre el fondo azul */}
      <Box
        component="img"
        src="/logo_blanco.png"
        alt="Municipalidad de Cabo de Hornos"
        sx={{ height: 80, width: 'auto' }}
      />

      <Card sx={{ maxWidth: 400, width: '100%', overflow: 'hidden' }}>
        <CorporateColorBar height={5} />
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h5" fontWeight="bold" color="primary">
              Bienvenido
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sistema Unificado de Correspondencia
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Municipalidad de Cabo de Hornos
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="RUT"
              value={rut}
              onChange={handleRutChange}
              placeholder="12345678-9"
              sx={{ mb: 2 }}
              disabled={loading}
              autoComplete="username"
            />

            <TextField
              fullWidth
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 3 }}
              disabled={loading}
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || !rut || !password}
              startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </Box>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button variant="text" size="small" onClick={() => navigate('/recuperar-password')}>
              ¿Olvidaste tu contraseña?
            </Button>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Button variant="text" onClick={() => navigate('/portal-ciudadano')} size="small">
              Ir al Portal Ciudadano
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={confirmReuso} onClose={() => setConfirmReuso(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Sesión ya en uso</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmMsg} ¿Deseas continuar e iniciar sesión aquí?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReuso(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmReuso}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            Continuar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Login
