import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Interceptor para agregar token y, si estoy "actuando como" otro usuario
// por subrogancia, el header X-Actuando-Como con su id. El perfil elegido
// viaja en X-Perfil-Activo para que el backend acote los roles efectivos
// (un oficial en perfil "usuario" no debe ver como oficial).
api.interceptors.request.use(
  (config) => {
    // Si esta pestaña está "actuando como" (subrogancia) y tiene su propio
    // token de subrogancia, se usa ese; si no, el token propio (localStorage,
    // compartido entre pestañas). Así la sesión de subrogancia es independiente.
    const actuandoComoId = sessionStorage.getItem('actuandoComoId')
    const subrogToken = sessionStorage.getItem('subrogToken')
    const token = actuandoComoId && subrogToken ? subrogToken : localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (actuandoComoId) {
      config.headers['X-Actuando-Como'] = actuandoComoId
    }
    // Modo auditoría del admin ("ver como", solo lectura): usa el token propio
    // del admin (arriba) + este header para que el backend acote la vista.
    const auditarComoId = sessionStorage.getItem('auditarComoId')
    if (auditarComoId) {
      config.headers['X-Auditar-Como'] = auditarComoId
    }
    const selectedRole = sessionStorage.getItem('selectedRole')
    if (selectedRole) {
      config.headers['X-Perfil-Activo'] = selectedRole
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      sessionStorage.removeItem('selectedRole')
      sessionStorage.removeItem('actuandoComoId')
      sessionStorage.removeItem('actuandoComo')
      sessionStorage.removeItem('subrogToken')
      sessionStorage.removeItem('auditarComoId')
      sessionStorage.removeItem('auditarComo')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
