import { useState, useEffect, useCallback, useRef } from 'react'
import { useSondeo } from './useSondeo'
import { chatAPI, ChatConversacionResumen, ChatMensaje } from '../api/common'
import { sonarMensajeNuevo } from '../utils/sonidoChat'

/** Sondeo del contador de no leídos (panel cerrado). */
const INTERVALO_BADGE = 30000
/**
 * Sondeo de la conversación abierta.
 *
 * Dos segundos: se puede permitir porque la consulta es incremental (pide solo
 * lo posterior al último mensaje recibido), así que cuando no hay nada nuevo la
 * respuesta pesa unas decenas de bytes. Antes traía el hilo completo cada vez.
 */
const INTERVALO_HILO = 2000

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
  /** Hasta cuándo leyó el interlocutor: con eso se marcan los propios como vistos. */
  const [leidoPorElOtro, setLeidoPorElOtro] = useState<string | null>(null)
  /** Último mensaje que ya tenemos: es lo que se manda como `desde`. */
  const ultimoIdRef = useRef<number>(0)
  // Referencias para detectar la LLEGADA de un mensaje y avisar con sonido.
  // La primera carga nunca suena: si no, entrar a la plataforma con mensajes
  // pendientes dispararía el aviso de algo que no acaba de pasar.
  const noLeidosPrevios = useRef<number | null>(null)

  const cargarBadge = useCallback(async () => {
    if (!habilitado) return
    try {
      const res = await chatAPI.noLeidos()
      if (!res.success) return
      const actual = res.data.no_leidos
      if (noLeidosPrevios.current !== null && actual > noLeidosPrevios.current) {
        sonarMensajeNuevo()
      }
      noLeidosPrevios.current = actual
      setNoLeidos(actual)
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

  const cargarHilo = useCallback(async (id: number, inicial = false) => {
    if (inicial) {
      setCargandoHilo(true)
      // Abrir una conversación pide el hilo entero y no suena: los mensajes que
      // ya estaban no son novedad.
      ultimoIdRef.current = 0
    }
    try {
      const res = await chatAPI.mensajes(id, inicial ? undefined : ultimoIdRef.current || undefined)
      if (!res.success) return

      const llegados = res.data.mensajes
      if (llegados.length > 0) {
        ultimoIdRef.current = llegados[llegados.length - 1].id
      }

      if (res.data.incremental) {
        if (llegados.length > 0) {
          setMensajes(prev => {
            // Defensa contra la duplicación: el envío propio ya añadió su
            // mensaje al vuelo, y el sondeo puede traerlo de nuevo.
            const conocidos = new Set(prev.map(m => m.id))
            const nuevos = llegados.filter(m => !conocidos.has(m.id))
            return nuevos.length ? [...prev, ...nuevos] : prev
          })
          // Con el hilo abierto el contador no sube (se marca leído al vuelo),
          // así que el aviso se dispara con lo que llega del otro.
          if (llegados.some(m => !m.mio)) sonarMensajeNuevo()
        }
      } else {
        setMensajes(llegados)
      }

      setLeidoPorElOtro(res.data.leido_por_el_otro ?? null)
    } catch { /* sondeo silencioso */ } finally {
      if (inicial) setCargandoHilo(false)
    }
  }, [])

  const enviar = useCallback(async (destinatarioId: number, cuerpo: string) => {
    const res = await chatAPI.enviar(destinatarioId, cuerpo)
    if (res.success) {
      // Se agrega de inmediato: esperar al siguiente sondeo se siente lento.
      setMensajes(prev => [...prev, res.data.mensaje])
      ultimoIdRef.current = Math.max(ultimoIdRef.current, res.data.mensaje.id)
      cargarConversaciones()
      return res.data.conversacion_id
    }
    return null
  }, [cargarConversaciones])

  // Cambiar de conversación (o cerrar el hilo) reinicia el punto de partida del
  // incremental: pedir "lo posterior al mensaje 42" en otra conversación
  // devolvería cualquier cosa.
  useEffect(() => {
    ultimoIdRef.current = 0
    setLeidoPorElOtro(null)
  }, [conversacionAbierta])

  // El hilo abierto manda el ritmo; si no hay ninguno, solo el contador.
  // Se detiene con la pestaña oculta, pero NO por falta de actividad: si no,
  // quien lleva unos minutos leyendo sin tocar el mouse no se entera de que le
  // escribieron. Puede permitírselo porque la presencia tiene señal propia.
  useSondeo(
    () => {
      if (conversacionAbierta) cargarHilo(conversacionAbierta)
      cargarBadge()
    },
    conversacionAbierta ? INTERVALO_HILO : INTERVALO_BADGE,
    habilitado,
    false // el aviso debe llegar aunque la persona lleve un rato sin tocar el mouse
  )

  // Al deshabilitarse (cierre de sesión, pantalla chica) no debe quedar rastro.
  useEffect(() => {
    if (!habilitado) {
      setNoLeidos(0)
      noLeidosPrevios.current = null
      ultimoIdRef.current = 0
    }
  }, [habilitado])

  return {
    conversaciones,
    mensajes,
    setMensajes,
    leidoPorElOtro,
    noLeidos,
    cargandoHilo,
    cargarConversaciones,
    cargarHilo,
    enviar,
  }
}
