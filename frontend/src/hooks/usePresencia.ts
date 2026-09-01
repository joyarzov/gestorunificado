import { useState, useEffect, useCallback, useRef } from 'react'
import { presenciaAPI, UsuarioPresencia } from '../api/common'

/**
 * Cada cuánto se refresca la lista de conectados.
 *
 * Un minuto basta: la presencia no es un dato que cambie a cada segundo, y con
 * ~20 funcionarios esto es una petición cada 60 s por sesión abierta. Además,
 * cada consulta refresca el propio `last_used_at`, de modo que quien tiene el
 * panel abierto se mantiene visible para el resto.
 */
const INTERVALO = 60000

export const usePresencia = (isAuthenticated: boolean) => {
  const [usuarios, setUsuarios] = useState<UsuarioPresencia[]>([])
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const enLinea = usuarios.filter(u => u.estado === 'en_linea')

  const cargar = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await presenciaAPI.listar()
      if (res.success) setUsuarios(res.data.usuarios)
    } catch {
      // Silencioso: es un sondeo de fondo. Un corte de red no debe ensuciar
      // la pantalla con errores; en el siguiente ciclo se recupera solo.
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setUsuarios([])
      setLoading(false)
      return
    }

    // El sondeo solo corre con la pestaña a la vista.
    //
    // Esto es lo que hace que "en línea" signifique algo: como cada petición
    // refresca el propio last_used_at, un sondeo que siguiera corriendo en
    // segundo plano dejaría verde a quien se fue a almorzar con el navegador
    // abierto. Al ocultarse la pestaña se corta, el reloj empieza a correr y
    // la persona pasa a "ausente" sola; al volver, se refresca de inmediato.
    const arrancar = () => {
      if (timerRef.current) return
      timerRef.current = setInterval(cargar, INTERVALO)
    }
    const detener = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        detener()
      } else {
        cargar()
        arrancar()
      }
    }

    if (!document.hidden) {
      cargar()
      arrancar()
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      detener()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [isAuthenticated, cargar])

  return { usuarios, enLinea, totalEnLinea: enLinea.length, loading, recargar: cargar }
}
