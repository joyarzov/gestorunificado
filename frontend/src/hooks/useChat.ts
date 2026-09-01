import { useState, useEffect, useCallback, useRef } from 'react'
import { chatAPI, ChatConversacionResumen, ChatMensaje } from '../api/common'

/** Sondeo del contador de no leídos (panel cerrado). */
const INTERVALO_BADGE = 30000
/** Sondeo de la conversación abierta: acá sí se espera que se sienta vivo. */
const INTERVALO_HILO = 5000

/**
 * Estado del chat: contador de no leídos, lista de conversaciones y el hilo
 * abierto.
 *
 * Todo por sondeo, y siempre pausado cuando la pestaña no está a la vista:
 * además de ahorrar peticiones, cada llamada refresca `last_used_at`, que es
 * de donde sale la presencia. Sondear en segundo plano dejaría "en línea" a
 * quien no está.
 */
export const useChat = (habilitado: boolean, conversacionAbierta: number | null) => {
  const [conversaciones, setConversaciones] = useState<ChatConversacionResumen[]>([])
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([])
  const [noLeidos, setNoLeidos] = useState(0)
  const [cargandoHilo, setCargandoHilo] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cargarBadge = useCallback(async () => {
    if (!habilitado) return
    try {
      const res = await chatAPI.noLeidos()
      if (res.success) setNoLeidos(res.data.no_leidos)
    } catch { /* sondeo silencioso */ }
  }, [habilitado])

  const cargarConversaciones = useCallback(async () => {
    if (!habilitado) return
    try {
      const res = await chatAPI.conversaciones()
      if (res.success) {
        setConversaciones(res.data.conversaciones)
        setNoLeidos(res.data.no_leidos)
      }
    } catch { /* sondeo silencioso */ }
  }, [habilitado])

  const cargarHilo = useCallback(async (id: number, conSpinner = false) => {
    if (conSpinner) setCargandoHilo(true)
    try {
      const res = await chatAPI.mensajes(id)
      if (res.success) setMensajes(res.data.mensajes)
    } catch { /* sondeo silencioso */ } finally {
      if (conSpinner) setCargandoHilo(false)
    }
  }, [])

  const enviar = useCallback(async (destinatarioId: number, cuerpo: string) => {
    const res = await chatAPI.enviar(destinatarioId, cuerpo)
    if (res.success) {
      // Se agrega de inmediato: esperar al siguiente sondeo se siente lento.
      setMensajes(prev => [...prev, res.data.mensaje])
      cargarConversaciones()
      return res.data.conversacion_id
    }
    return null
  }, [cargarConversaciones])

  // Sondeo: el hilo abierto manda; si no hay ninguno, solo el contador.
  useEffect(() => {
    if (!habilitado) {
      setNoLeidos(0)
      return
    }

    const tick = () => {
      if (conversacionAbierta) {
        cargarHilo(conversacionAbierta)
        cargarBadge()
      } else {
        cargarBadge()
      }
    }

    const arrancar = () => {
      if (timerRef.current) return
      timerRef.current = setInterval(tick, conversacionAbierta ? INTERVALO_HILO : INTERVALO_BADGE)
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
        tick()
        arrancar()
      }
    }

    tick()
    if (!document.hidden) arrancar()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      detener()
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [habilitado, conversacionAbierta, cargarBadge, cargarHilo])

  return {
    conversaciones,
    mensajes,
    setMensajes,
    noLeidos,
    cargandoHilo,
    cargarConversaciones,
    cargarHilo,
    enviar,
  }
}
