import { useEffect, useState } from 'react'
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
  MenuItem,
} from '@mui/material'
import { Save as SaveIcon, ArrowBack as BackIcon, SwapHoriz as SubroganteIcon } from '@mui/icons-material'
import { authAPI } from '../../api/auth'
import { useAuth } from '../../contexts/AuthContext'
import { usersAPI } from '../../api/common'
import { organigramaAPI } from '../../api/organigrama'
import { User } from '../../types'

const ChangePassword = () => {
  const navigate = useNavigate()
  const { user, checkAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Profile form
  const [cargo, setCargo] = useState(user?.cargo || '')
  const [profileLoading, setProfileLoading] = useState(false)

  // Subrogante
  const [funcionarios, setFuncionarios] = useState<User[]>([])
  const [subroganteId, setSubroganteId] = useState<number | ''>(user?.subrogante_id ?? '')
  const [subroganteLoading, setSubroganteLoading] = useState(false)

  useEffect(() => {
    setSubroganteId(user?.subrogante_id ?? '')
  }, [user?.subrogante_id])

  useEffect(() => {
    usersAPI.funcionarios()
      .then((r) => setFuncionarios((r.data ?? []).filter((u) => u.id !== user?.id && u.activo)))
      .catch(() => {})
  }, [user?.id])

  const handleUpdateSubrogante = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubroganteLoading(true)
    try {
      await organigramaAPI.actualizarMiSubrogante(subroganteId === '' ? null : Number(subroganteId))
      await checkAuth()
      setSuccess('Subrogante actualizado')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any)?.response?.data?.message || 'Error al actualizar subrogante')
    } finally {
      setSubroganteLoading(false)
    }
  }

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

      {/* Subrogante Section */}
      <Card sx={{ maxWidth: 500, mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SubroganteIcon color="primary" />
            <Typography variant="h6">Mi subrogante</Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Funcionario que te reemplazará en tus funciones cuando no estés disponible.
          </Typography>

          <Box component="form" onSubmit={handleUpdateSubrogante}>
            <TextField
              select
              fullWidth
              label="Subrogante"
              value={subroganteId}
              onChange={(e) => setSubroganteId(e.target.value === '' ? '' : Number(e.target.value))}
              sx={{ mb: 2 }}
            >
              <MenuItem value="">— Sin asignar —</MenuItem>
              {funcionarios.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.nombre}
                  {f.cargo ? ` · ${f.cargo}` : ''}
                </MenuItem>
              ))}
            </TextField>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              startIcon={subroganteLoading ? <CircularProgress size={20} /> : <SaveIcon />}
              disabled={subroganteLoading}
            >
              {subroganteLoading ? 'Guardando…' : 'Guardar subrogante'}
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
