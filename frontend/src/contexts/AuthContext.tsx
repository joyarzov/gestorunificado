import { createContext, useState, useContext, useEffect, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { authAPI, AuditarFuncionario } from '../api/auth'
import { User, SubrogadoActivo } from '../types'

interface AuthContextType {
  user: User | null
  selectedRole: string | null
  actuandoComo: SubrogadoActivo | null
  loading: boolean
  showRoleSelector: boolean
  setShowRoleSelector: (show: boolean) => void
  login: (rut: string, password: string, forzar?: boolean) => Promise<void>
  logout: () => Promise<void>
  selectRole: (role: string) => void
  actuarComo: (subrogado: SubrogadoActivo, role: string) => Promise<void>
  salirDeActuandoComo: () => Promise<void>
  auditando: AuditarFuncionario | null
  esModoAuditoria: boolean
  auditarComo: (funcionarioId: number) => Promise<void>
  salirAuditoria: () => Promise<void>
  checkAuth: () => Promise<void>
  isAdmin: () => boolean
  isOficial: () => boolean
  isAlcalde: () => boolean
  hasRole: (role: string) => boolean
  hasAplicacion: (app: string) => boolean
  canViewAllCorrespondence: () => boolean
  canDerivarCorrespondence: () => boolean
  canViewRegistroCorrespondence: () => boolean
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
  const [auditando, setAuditandoState] = useState<AuditarFuncionario | null>(() => {
    const raw = sessionStorage.getItem('auditarComo')
    return raw ? (JSON.parse(raw) as AuditarFuncionario) : null
  })
  const [loading, setLoading] = useState(true)
  const [showRoleSelector, setShowRoleSelector] = useState(false)
  const location = useLocation()

  const esModoAuditoria = auditando !== null

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

      // Modo auditoría activo tras recargar: mantener la vista del funcionario
      // (su rol), sin pasar por la lógica de roles del admin.
      if (sessionStorage.getItem('auditarComoId') && auditando) {
        const rol = auditando.roles?.[0] ?? sessionStorage.getItem('selectedRole') ?? 'usuario'
        setSelectedRole(rol)
        setLoading(false)
        return
      }

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

  const login = async (rut: string, password: string, forzar = false) => {
    const response = await authAPI.login(rut, password, forzar)
    const { token, user: userData } = response.data

    localStorage.setItem('token', token)
    setUser(userData)
    setLoading(false)

    // Login fresco: cualquier "actuando como" o auditoría previa se descarta.
    setActuandoComoState(null)
    setAuditandoState(null)
    sessionStorage.removeItem('actuandoComo')
    sessionStorage.removeItem('actuandoComoId')
    sessionStorage.removeItem('subrogToken')
    sessionStorage.removeItem('auditarComo')
    sessionStorage.removeItem('auditarComoId')

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
  const actuarComo = async (subrogado: SubrogadoActivo, role: string) => {
    // Emite un token de subrogancia independiente (sobrevive a un nuevo login
    // propio en otro equipo). Si falla, se sigue operando con el token propio
    // para no romper la subrogancia. Se fuerza el reemplazo de una sesión de
    // subrogancia previa del mismo subrogado (es la misma persona reentrando).
    try {
      const res = await authAPI.subroganciaToken(subrogado.id, true)
      sessionStorage.setItem('subrogToken', res.data.token)
    } catch (error) {
      console.error('No se pudo emitir el token de subrogancia, se usa el token propio:', error)
      sessionStorage.removeItem('subrogToken')
    }
    setActuandoComoState(subrogado)
    sessionStorage.setItem('actuandoComo', JSON.stringify(subrogado))
    sessionStorage.setItem('actuandoComoId', String(subrogado.id))
    setSelectedRole(role)
    sessionStorage.setItem('selectedRole', role)
    setShowRoleSelector(false)
  }

  const salirDeActuandoComo = async () => {
    // Cierra solo la sesión de subrogancia (best-effort) antes de volver a la propia.
    if (sessionStorage.getItem('subrogToken')) {
      try {
        await authAPI.subroganciaLogout()
      } catch (error) {
        console.error('No se pudo cerrar la sesión de subrogancia:', error)
      }
    }
    sessionStorage.removeItem('subrogToken')
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

  /**
   * Modo auditoría ("ver como", solo admin): ver la plataforma como el
   * funcionario en SOLO LECTURA. Se limpia primero el header (para que la
   * llamada de inicio no vaya bloqueada), se registra en el backend y se
   * adopta el rol/aplicaciones del funcionario para reproducir su vista.
   */
  const auditarComo = async (funcionarioId: number) => {
    sessionStorage.removeItem('auditarComoId')
    // Auditoría y subrogancia son excluyentes.
    setActuandoComoState(null)
    sessionStorage.removeItem('actuandoComo')
    sessionStorage.removeItem('actuandoComoId')
    sessionStorage.removeItem('subrogToken')

    const res = await authAPI.auditarIniciar(funcionarioId)
    const f = res.data.funcionario
    setAuditandoState(f)
    sessionStorage.setItem('auditarComo', JSON.stringify(f))
    sessionStorage.setItem('auditarComoId', String(f.id))
    const rol = f.roles?.[0] ?? 'usuario'
    setSelectedRole(rol)
    sessionStorage.setItem('selectedRole', rol)
    setShowRoleSelector(false)
  }

  const salirAuditoria = async () => {
    sessionStorage.removeItem('auditarComoId')
    try {
      await authAPI.auditarLogout()
    } catch (error) {
      console.error('No se pudo registrar el fin de auditoría:', error)
    }
    setAuditandoState(null)
    sessionStorage.removeItem('auditarComo')
    // Volver a la sesión propia del admin.
    setSelectedRole('admin')
    sessionStorage.setItem('selectedRole', 'admin')
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
      setAuditandoState(null)
      localStorage.removeItem('token')
      sessionStorage.removeItem('selectedRole')
      sessionStorage.removeItem('actuandoComo')
      sessionStorage.removeItem('actuandoComoId')
      sessionStorage.removeItem('subrogToken')
      sessionStorage.removeItem('auditarComo')
      sessionStorage.removeItem('auditarComoId')
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
    const defaultsByRole: Record<string, string[]> = {
      oficial: ['correspondencia'],
      oirs: ['oirs'],
      alcalde: ['correspondencia', 'gestor_documental'],
      usuario: ['correspondencia', 'gestor_documental', 'oirs'],
      fomento_productivo: ['fomento_productivo'],
    }
    // En modo auditoría se usan las aplicaciones del FUNCIONARIO auditado, no
    // las del admin, para reproducir exactamente su menú.
    if (auditando) {
      if (auditando.aplicaciones_permitidas.length > 0) {
        return auditando.aplicaciones_permitidas.includes(app)
      }
      const defaults = selectedRole ? defaultsByRole[selectedRole] : null
      return defaults ? defaults.includes(app) : false
    }
    if (isAdmin()) return true
    // Si tiene aplicaciones explícitas, respetar esa configuración
    if (user?.aplicaciones_permitidas && user.aplicaciones_permitidas.length > 0) {
      return user.aplicaciones_permitidas.includes(app)
    }
    // Sin configuración explícita: defaults basados en el rol
    const defaults = selectedRole ? defaultsByRole[selectedRole] : null
    return defaults ? defaults.includes(app) : false
  }

  const canViewAllCorrespondence = () => {
    return selectedRole === 'admin' || selectedRole === 'oficial' || selectedRole === 'alcalde'
  }

  const canDerivarCorrespondence = () => {
    return selectedRole === 'admin' || selectedRole === 'oficial' || selectedRole === 'alcalde'
  }

  // Registro de correspondencia (solo lectura, todas): permiso explícito por usuario, o admin.
  const canViewRegistroCorrespondence = () => {
    if (auditando) return auditando.puede_ver_registro_correspondencia
    return isAdmin() || !!user?.puede_ver_registro_correspondencia
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
        auditando,
        esModoAuditoria,
        auditarComo,
        salirAuditoria,
        checkAuth,
        isAdmin,
        canViewRegistroCorrespondence,
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
