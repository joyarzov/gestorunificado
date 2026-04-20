import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../../contexts/AuthContext'
import { getModuleByPath } from '../../config/modules'

const PrivateRoute = () => {
  const { user, selectedRole, loading, hasAplicacion, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Si tiene múltiples roles y no ha seleccionado uno, esperar
  if (user.roles && user.roles.length > 1 && !selectedRole) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    )
  }

  // Validar acceso al módulo según la URL actual.
  const modulo = getModuleByPath(location.pathname)
  if (modulo) {
    if (modulo.id === 'administracion') {
      if (!isAdmin()) return <Navigate to="/portal" replace />
    } else if (modulo.id !== 'perfil') {
      if (!hasAplicacion(modulo.id)) return <Navigate to="/portal" replace />
    }
  }

  return <Outlet />
}

export default PrivateRoute
