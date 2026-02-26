import { createContext, useState, useContext, useEffect, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { authAPI } from '../api/auth'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  selectedRole: string | null
  loading: boolean
  showRoleSelector: boolean
  setShowRoleSelector: (show: boolean) => void
  login: (rut: string, password: string) => Promise<void>
  logout: () => Promise<void>
  selectRole: (role: string) => void
  checkAuth: () => Promise<void>
  isAdmin: () => boolean
  isOficial: () => boolean
  isAlcalde: () => boolean
  hasRole: (role: string) => boolean
  hasAplicacion: (app: string) => boolean
  canViewAllCorrespondence: () => boolean
  canDerivarCorrespondence: () => boolean
  isAuthenticated: () => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRoleSelector, setShowRoleSelector] = useState(false)
  const location = useLocation()

  useEffect(() => {
    // No verificar auth en rutas públicas
    const publicPaths = ['/', '/login', '/oirs', '/oirs/consultar']
    if (publicPaths.includes(location.pathname)) {
      setLoading(false)
      return
    }

    checkAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await authAPI.me()
      const userData = response.data
      setUser(userData)

      // Verificar roles
      if (userData.roles && userData.roles.length > 1) {
        const storedRole = sessionStorage.getItem('selectedRole')
        if (storedRole && userData.roles.includes(storedRole)) {
          setSelectedRole(storedRole)
        } else {
          setShowRoleSelector(true)
        }
      } else if (userData.roles && userData.roles.length === 1) {
        setSelectedRole(userData.roles[0])
        sessionStorage.setItem('selectedRole', userData.roles[0])
      }
    } catch {
      setUser(null)
      setSelectedRole(null)
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (rut: string, password: string) => {
    const response = await authAPI.login(rut, password)
    const { token, user: userData } = response.data

    localStorage.setItem('token', token)
    setUser(userData)
    setLoading(false)

    if (userData.roles && userData.roles.length > 1) {
      setShowRoleSelector(true)
    } else if (userData.roles && userData.roles.length === 1) {
      setSelectedRole(userData.roles[0])
      sessionStorage.setItem('selectedRole', userData.roles[0])
    }
  }

  const selectRole = (role: string) => {
    setSelectedRole(role)
    sessionStorage.setItem('selectedRole', role)
    setShowRoleSelector(false)
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    } finally {
      setUser(null)
      setSelectedRole(null)
      localStorage.removeItem('token')
      sessionStorage.removeItem('selectedRole')
    }
  }

  const isAdmin = () => {
    return selectedRole === 'admin' || user?.roles?.includes('admin') || false
  }

  const isOficial = () => {
    return selectedRole === 'oficial' || user?.roles?.includes('oficial') || false
  }

  const isAlcalde = () => {
    return selectedRole === 'alcalde'
  }

  const hasRole = (role: string) => {
    return selectedRole === role || user?.roles?.includes(role) || false
  }

  const hasAplicacion = (app: string) => {
    if (isAdmin()) return true
    // Si tiene aplicaciones explícitas, respetar esa configuración
    if (user?.aplicaciones_permitidas && user.aplicaciones_permitidas.length > 0) {
      return user.aplicaciones_permitidas.includes(app)
    }
    // Sin configuración explícita: defaults basados en el rol
    const defaultsByRole: Record<string, string[]> = {
      oficial: ['correspondencia', 'oirs'],
      oirs: ['oirs'],
      alcalde: ['correspondencia', 'gestor_documental'],
      usuario: ['correspondencia', 'gestor_documental', 'oirs'],
    }
    const defaults = selectedRole ? defaultsByRole[selectedRole] : null
    return defaults ? defaults.includes(app) : false
  }

  const canViewAllCorrespondence = () => {
    return selectedRole === 'admin' || selectedRole === 'oficial' || selectedRole === 'alcalde'
  }

  const canDerivarCorrespondence = () => {
    return selectedRole === 'admin' || selectedRole === 'oficial' || selectedRole === 'alcalde'
  }

  const isAuthenticated = () => {
    return user !== null && selectedRole !== null
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        selectedRole,
        loading,
        showRoleSelector,
        setShowRoleSelector,
        login,
        logout,
        selectRole,
        checkAuth,
        isAdmin,
        isOficial,
        isAlcalde,
        hasRole,
        hasAplicacion,
        canViewAllCorrespondence,
        canDerivarCorrespondence,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
