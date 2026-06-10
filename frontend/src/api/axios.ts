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
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const actuandoComoId = sessionStorage.getItem('actuandoComoId')
    if (actuandoComoId) {
      config.headers['X-Actuando-Como'] = actuandoComoId
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
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
