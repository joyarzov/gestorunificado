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

  // Se detiene con la pestaña oculta, pero NO por falta de actividad: los
  // avisos deben llegar aunque la persona lleve un rato sin tocar el equipo.
  // Ya no ensucia la presencia, que se marca por su cuenta.
  useSondeo(
    () => { if (isAuthenticated) fetchNoLeidas() },
    POLLING_INTERVAL,
    isAuthenticated,
    false // el aviso debe llegar aunque la persona lleve un rato sin tocar el mouse
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
