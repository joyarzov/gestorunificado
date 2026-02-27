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

    fetchNoLeidas()

    intervalRef.current = setInterval(fetchNoLeidas, POLLING_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
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
