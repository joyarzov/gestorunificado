import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material'
import { Save as SaveIcon, ArrowBack as BackIcon } from '@mui/icons-material'
import { authAPI } from '../../api/auth'

const ChangePassword = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    currentPassword: '',
    password: '',
    passwordConfirmation: '',
  })

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (formData.password !== formData.passwordConfirmation) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      await authAPI.changePassword(
        formData.currentPassword,
        formData.password,
        formData.passwordConfirmation
      )
      setSuccess(true)
      setFormData({
        currentPassword: '',
        password: '',
        passwordConfirmation: '',
      })
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'Error al cambiar contraseña')
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
          Cambiar Contraseña
        </Typography>
      </Box>

      <Card sx={{ maxWidth: 500 }}>
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Contraseña actualizada correctamente
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              type="password"
              label="Contraseña Actual"
              value={formData.currentPassword}
              onChange={(e) => handleChange('currentPassword', e.target.value)}
              sx={{ mb: 2 }}
              required
            />

            <TextField
              fullWidth
              type="password"
              label="Nueva Contraseña"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              sx={{ mb: 2 }}
              required
              helperText="Mínimo 6 caracteres"
            />

            <TextField
              fullWidth
              type="password"
              label="Confirmar Nueva Contraseña"
              value={formData.passwordConfirmation}
              onChange={(e) => handleChange('passwordConfirmation', e.target.value)}
              sx={{ mb: 3 }}
              required
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
              disabled={loading || !formData.currentPassword || !formData.password || !formData.passwordConfirmation}
            >
              {loading ? 'Guardando...' : 'Cambiar Contraseña'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default ChangePassword
