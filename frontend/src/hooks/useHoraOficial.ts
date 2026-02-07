import { useState, useEffect, useRef } from 'react'
import { horaOficialAPI } from '../api/common'

const TIMEZONE = 'America/Punta_Arenas'
const SYNC_INTERVAL_MS = 5 * 60 * 1000 // Re-sync cada 5 minutos

/**
 * Hook que muestra la Hora Oficial de Chile (Magallanes, UTC-3)
 * sincronizada con el servidor NTP del SHOA (ntp.shoa.cl).
 *
 * Obtiene la hora del backend (que debe estar sincronizado con ntp.shoa.cl),
 * calcula el offset con el reloj local, y actualiza cada segundo.
 */
export function useHoraOficial() {
  const [hora, setHora] = useState('')
  const [fecha, setFecha] = useState('')
  const offsetRef = useRef(0) // diferencia servidor - cliente en ms
  const syncedRef = useRef(false)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-CL', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-CL', {
      timeZone: TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const syncWithServer = async () => {
    try {
      const requestStart = Date.now()
      const res = await horaOficialAPI.obtener()
      const requestEnd = Date.now()
      const latency = (requestEnd - requestStart) / 2

      const serverTime = new Date(res.data.timestamp).getTime()
      offsetRef.current = serverTime + latency - requestEnd
      syncedRef.current = true
    } catch {
      // Si falla, usar reloj local (offset = 0)
      if (!syncedRef.current) {
        offsetRef.current = 0
      }
    }
  }

  useEffect(() => {
    // Sync inicial
    syncWithServer()

    // Re-sync periódico
    const syncTimer = setInterval(syncWithServer, SYNC_INTERVAL_MS)

    // Tick cada segundo
    const tickTimer = setInterval(() => {
      const correctedNow = new Date(Date.now() + offsetRef.current)
      setHora(formatTime(correctedNow))
      setFecha(formatDate(correctedNow))
    }, 1000)

    // Primer tick inmediato
    const now = new Date(Date.now() + offsetRef.current)
    setHora(formatTime(now))
    setFecha(formatDate(now))

    return () => {
      clearInterval(syncTimer)
      clearInterval(tickTimer)
    }
  }, [])

  return { hora, fecha, timezone: TIMEZONE }
}
