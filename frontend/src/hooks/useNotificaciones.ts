import { useState, useEffect, useCallback, useRef } from 'react'
import { notificacionesAPI } from '../api/common'
import { Notificacion } from '../types'

const POLLING_INTERVAL = 30000 // 30 seconds

export const useNotificaciones = (isAuthenticated: boolean) => {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const contadorNoLeidas = notificaciones.length

  const fetchNoLeidas = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await notificacionesAPI.noLeidas()
      if (res.success) setNotificaciones(res.data)
    } catch {
      // silent fail for polling
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  const marcarLeida = useCallback(async (id: number) => {
    try {
      await notificacionesAPI.marcarLeida(id)
      setNotificaciones(prev => prev.filter(n => n.id !== id))
    } catch {
      // ignore
    }
  }, [])

  const marcarTodasLeidas = useCallback(async () => {
    try {
      await notificacionesAPI.marcarTodasLeidas()
      setNotificaciones([])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setNotificaciones([])
      setLoading(false)
      return
    }

    // El sondeo solo corre con la pestaña a la vista. Dos razones: el contador
    // solo se ve cuando alguien está mirando, y —sobre todo— cada petición
    // refresca last_used_at, que es de donde sale la presencia del globo
    // flotante. Sondeando en segundo plano, quien dejó el navegador abierto
    // aparecería "en línea" indefinidamente. Al volver a la pestaña se
    // recarga al instante, así que no se pierde ningún aviso.
    const arrancar = () => {
      if (intervalRef.current) return
      intervalRef.current = setInterval(fetchNoLeidas, POLLING_INTERVAL)
    }
    const detener = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        detener()
      } else {
        fetchNoLeidas()
        arrancar()
      }
    }

    fetchNoLeidas()
    if (!document.hidden) arrancar()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      detener()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [isAuthenticated, fetchNoLeidas])

  return {
    notificaciones,
    loading,
    contadorNoLeidas,
    fetchNoLeidas,
    marcarLeida,
    marcarTodasLeidas,
  }
}
