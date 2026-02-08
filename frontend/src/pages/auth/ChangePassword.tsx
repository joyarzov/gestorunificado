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
import { useAuth } from '../../contexts/AuthContext'

const ChangePassword = () => {
  const navigate = useNavigate()
  const { user, checkAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Profile form
  const [cargo, setCargo] = useState(user?.cargo || '')
  const [profileLoading, setProfileLoading] = useState(false)

  // Password form
  const [formData, setFormData] = useState({
    currentPassword: '',
    password: '',
    passwordConfirmation: '',
  })

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setProfileLoading(true)
    try {
      await authAPI.updateProfile({ cargo })
      await checkAuth()
      setSuccess('Perfil actualizado correctamente')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'Error al actualizar perfil')
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

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
      setSuccess('Contraseña actualizada correctamente')
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
          Mi Perfil
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {/* Profile Section */}
      <Card sx={{ maxWidth: 500, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Datos del Perfil
          </Typography>

          <TextField
            fullWidth
            label="Nombre"
            value={user?.nombre || ''}
            disabled
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="RUT"
            value={user?.rut || ''}
            disabled
            sx={{ mb: 2 }}
          />

          <Box component="form" onSubmit={handleUpdateProfile}>
            <TextField
              fullWidth
              label="Cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ej: Jefe de Departamento, Secretario Municipal..."
              sx={{ mb: 2 }}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              startIcon={profileLoading ? <CircularProgress size={20} /> : <SaveIcon />}
              disabled={profileLoading}
            >
              {profileLoading ? 'Guardando...' : 'Guardar Cargo'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card sx={{ maxWidth: 500 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Cambiar Contraseña
          </Typography>

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
