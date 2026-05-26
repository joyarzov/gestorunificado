import { createContext, useState, useContext, useEffect, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { authAPI } from '../api/auth'
import { User, SubrogadoActivo } from '../types'

interface AuthContextType {
  user: User | null
  selectedRole: string | null
  actuandoComo: SubrogadoActivo | null
  loading: boolean
  showRoleSelector: boolean
  setShowRoleSelector: (show: boolean) => void
  login: (rut: string, password: string) => Promise<void>
  logout: () => Promise<void>
  selectRole: (role: string) => void
  actuarComo: (subrogado: SubrogadoActivo, role: string) => void
  salirDeActuandoComo: () => void
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
  const [actuandoComo, setActuandoComoState] = useState<SubrogadoActivo | null>(() => {
    const raw = sessionStorage.getItem('actuandoComo')
    return raw ? (JSON.parse(raw) as SubrogadoActivo) : null
  })
  const [loading, setLoading] = useState(true)
  const [showRoleSelector, setShowRoleSelector] = useState(false)
  const location = useLocation()

  useEffect(() => {
    // No verificar auth en rutas públicas
    const publicPaths = ['/', '/login', '/oirs', '/oirs/consultar', '/fondos/postular', '/fondos/seguimiento']
    const isPublicSubpath = location.pathname.startsWith('/fondos/postular/') || location.pathname.startsWith('/verificar/')
    if (publicPaths.includes(location.pathname) || isPublicSubpath) {
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

      // Restaurar contexto de subrogancia si vino guardado, validándolo
      // contra los subrogados activos que devuelve el backend.
      const storedActComoId = sessionStorage.getItem('actuandoComoId')
      const subrogadoVigente = storedActComoId
        ? userData.subrogados_activos?.find((s) => String(s.id) === storedActComoId)
        : null
      if (storedActComoId && !subrogadoVigente) {
        // El subrogado ya no tiene subrogancia activa (la desactivaron). Limpio.
        sessionStorage.removeItem('actuandoComo')
        sessionStorage.removeItem('actuandoComoId')
        setActuandoComoState(null)
      } else if (subrogadoVigente) {
        setActuandoComoState(subrogadoVigente)
      }

      const opcionesSubrogancia = userData.subrogados_activos?.length ?? 0
      const totalOpciones = (userData.roles?.length ?? 0) + opcionesSubrogancia

      // Si hay un rol guardado y sigue siendo válido, lo mantengo.
      const storedRole = sessionStorage.getItem('selectedRole')
      const rolesValidos = subrogadoVigente
        ? subrogadoVigente.roles
        : userData.roles ?? []
      if (storedRole && rolesValidos.includes(storedRole)) {
        setSelectedRole(storedRole)
      } else if (totalOpciones > 1) {
        setShowRoleSelector(true)
      } else if (userData.roles?.length === 1) {
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

    // Login fresco: cualquier "actuando como" previo de otra sesión se descarta.
    setActuandoComoState(null)
    sessionStorage.removeItem('actuandoComo')
    sessionStorage.removeItem('actuandoComoId')

    const opcionesSubrogancia = userData.subrogados_activos?.length ?? 0
    const totalOpciones = (userData.roles?.length ?? 0) + opcionesSubrogancia

    if (totalOpciones > 1) {
      setShowRoleSelector(true)
    } else if (userData.roles && userData.roles.length === 1) {
      setSelectedRole(userData.roles[0])
      sessionStorage.setItem('selectedRole', userData.roles[0])
    }
  }

  const selectRole = (role: string) => {
    setSelectedRole(role)
    sessionStorage.setItem('selectedRole', role)
    // Elegir un rol propio implica salir del modo subrogancia.
    setActuandoComoState(null)
    sessionStorage.removeItem('actuandoComo')
    sessionStorage.removeItem('actuandoComoId')
    setShowRoleSelector(false)
  }

  /**
   * Entra al modo "Actuar como X (subrogancia)". El selectedRole se setea al
   * rol del subrogado para que los checks de UI (isAlcalde, isOficial, etc.)
   * funcionen, y se guarda el subrogado para que axios mande X-Actuando-Como
   * y el backend honre los permisos heredados.
   */
  const actuarComo = (subrogado: SubrogadoActivo, role: string) => {
    setActuandoComoState(subrogado)
    sessionStorage.setItem('actuandoComo', JSON.stringify(subrogado))
    sessionStorage.setItem('actuandoComoId', String(subrogado.id))
    setSelectedRole(role)
    sessionStorage.setItem('selectedRole', role)
    setShowRoleSelector(false)
  }

  const salirDeActuandoComo = () => {
    setActuandoComoState(null)
    sessionStorage.removeItem('actuandoComo')
    sessionStorage.removeItem('actuandoComoId')
    // Volver a pedir selección entre los roles propios.
    setSelectedRole(null)
    sessionStorage.removeItem('selectedRole')
    if (user?.roles && user.roles.length > 1) {
      setShowRoleSelector(true)
    } else if (user?.roles && user.roles.length === 1) {
      setSelectedRole(user.roles[0])
      sessionStorage.setItem('selectedRole', user.roles[0])
    }
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    } finally {
      setUser(null)
      setSelectedRole(null)
      setActuandoComoState(null)
      localStorage.removeItem('token')
      sessionStorage.removeItem('selectedRole')
      sessionStorage.removeItem('actuandoComo')
      sessionStorage.removeItem('actuandoComoId')
    }
  }

  const isAdmin = () => {
    return selectedRole === 'admin'
  }

  const isOficial = () => {
    return selectedRole === 'oficial'
  }

  const isAlcalde = () => {
    return selectedRole === 'alcalde'
  }

  const hasRole = (role: string) => {
    return selectedRole === role
  }

  const hasAplicacion = (app: string) => {
    if (isAdmin()) return true
    // Si tiene aplicaciones explícitas, respetar esa configuración
    if (user?.aplicaciones_permitidas && user.aplicaciones_permitidas.length > 0) {
      return user.aplicaciones_permitidas.includes(app)
    }
    // Sin configuración explícita: defaults basados en el rol
    const defaultsByRole: Record<string, string[]> = {
      oficial: ['correspondencia'],
      oirs: ['oirs'],
      alcalde: ['correspondencia', 'gestor_documental'],
      usuario: ['correspondencia', 'gestor_documental', 'oirs'],
      fomento_productivo: ['fomento_productivo'],
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
        actuandoComo,
        loading,
        showRoleSelector,
        setShowRoleSelector,
        login,
        logout,
        selectRole,
        actuarComo,
        salirDeActuandoComo,
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
