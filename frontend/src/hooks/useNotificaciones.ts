import { useState, useCallback, useEffect } from 'react'
import { notificacionesAPI } from '../api/common'
import { Notificacion } from '../types'
import { useSondeo } from './useSondeo'

const POLLING_INTERVAL = 30000 // 30 seconds

export const useNotificaciones = (isAuthenticated: boolean) => {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)

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

  // El sondeo lo gobierna useSondeo: se detiene con la pestaña oculta o sin
  // actividad. Además de ahorrar peticiones, evita que este sondeo mantenga
  // "en línea" a quien dejó el navegador abierto y se fue.
  useSondeo(
    () => { if (isAuthenticated) fetchNoLeidas() },
    POLLING_INTERVAL,
    isAuthenticated
  )

  // Al cerrar sesión no debe quedar nada en pantalla.
  useEffect(() => {
    if (!isAuthenticated) {
      setNotificaciones([])
      setLoading(false)
    }
  }, [isAuthenticated])

  return {
    notificaciones,
    loading,
    contadorNoLeidas,
    fetchNoLeidas,
    marcarLeida,
    marcarTodasLeidas,
  }
}
