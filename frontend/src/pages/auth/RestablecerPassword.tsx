import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material'
import { Visibility, VisibilityOff, LockReset as ResetIcon } from '@mui/icons-material'
import { authAPI } from '../../api/auth'
import CorporateColorBar from '../../components/branding/CorporateColorBar'

const RestablecerPassword = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordCorta = password.length > 0 && password.length < 8
  const noCoincide = confirmacion.length > 0 && confirmacion !== password
  const valido = token && password.length >= 8 && confirmacion === password

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valido) return
    setError('')
    setLoading(true)
    try {
      await authAPI.resetPassword(token, password, confirmacion)
      setListo(true)
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'No se pudo restablecer la contraseña. Intenta nuevamente.')
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
              Nueva contraseña
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Define tu nueva contraseña de acceso
            </Typography>
          </Box>

          {!token ? (
            <>
              <Alert severity="error" sx={{ mb: 3 }}>
                El enlace no es válido. Solicita uno nuevo desde "Recuperar contraseña".
              </Alert>
              <Button fullWidth variant="contained" onClick={() => navigate('/recuperar-password')}>
                Solicitar enlace nuevo
              </Button>
            </>
          ) : listo ? (
            <>
              <Alert severity="success" sx={{ mb: 3 }}>
                Contraseña restablecida correctamente. Por seguridad se cerraron todas
                tus sesiones activas. Ya puedes iniciar sesión con tu nueva contraseña.
              </Alert>
              <Button fullWidth variant="contained" onClick={() => navigate('/login')}>
                Ir al inicio de sesión
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
                label="Nueva contraseña"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 2 }}
                disabled={loading}
                autoComplete="new-password"
                error={passwordCorta}
                helperText={passwordCorta ? 'Mínimo 8 caracteres' : 'Mínimo 8 caracteres'}
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
              <TextField
                fullWidth
                label="Confirmar contraseña"
                type={showPassword ? 'text' : 'password'}
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                sx={{ mb: 3 }}
                disabled={loading}
                autoComplete="new-password"
                error={noCoincide}
                helperText={noCoincide ? 'Las contraseñas no coinciden' : ' '}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || !valido}
                startIcon={loading ? <CircularProgress size={20} /> : <ResetIcon />}
              >
                {loading ? 'Guardando…' : 'Restablecer contraseña'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default RestablecerPassword
