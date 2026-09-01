import { useEffect, useRef } from 'react'

/**
 * Minutos sin mover el mouse, teclear o hacer scroll tras los cuales se
 * considera que la persona dejó el puesto.
 *
 * Quince, no tres. Con tres, la lista de conectados quedaba prácticamente
 * vacía: en una oficina municipal se atiende público, se contesta el teléfono
 * y se revisan papeles: nadie toca el mouse cada tres minutos, y gente que
 * estaba trabajando desaparecía de la lista.
 *
 * Quince minutos es el punto en que "no ha tocado el equipo" empieza a
 * significar de verdad "no está": suficiente para no borrar a quien está
 * ocupado, y bastante menos que dejar a alguien en verde toda la tarde.
 */
const MINUTOS_INACTIVIDAD = 15
const MS_INACTIVIDAD = MINUTOS_INACTIVIDAD * 60 * 1000

/** Eventos que cuentan como "hay alguien aquí". */
const EVENTOS_ACTIVIDAD = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']

/**
 * Sondeo periódico que solo corre cuando hay alguien realmente frente a la
 * pantalla.
 *
 * Es el único lugar donde vive la regla de "cuándo consultar al servidor", y
 * de eso depende que la presencia signifique algo: como cada petición refresca
 * la marca de sesión, un sondeo que siguiera corriendo dejaría "en línea" a
 * quien se fue. Se detiene por dos motivos:
 *
 *  1. La pestaña deja de estar a la vista (cambio de pestaña, minimizar).
 *  2. Nadie toca el equipo por MINUTOS_INACTIVIDAD, aunque la pestaña siga al
 *     frente — el caso del navegador abierto sobre un escritorio vacío.
 *
 * Sobre la detección de actividad: solo se sabe QUE ocurrió un evento, nunca
 * cuál. No se registra ni se envía nada; el dato vive en memoria y muere al
 * cerrar la pestaña.
 */
export const useSondeo = (
  tarea: () => void,
  intervaloMs: number,
  habilitado: boolean,
  /**
   * Si el sondeo debe detenerse cuando nadie toca el equipo.
   *
   * Verdadero para la presencia: de eso depende que el verde no mienta.
   * FALSO para el chat y las notificaciones, que necesitan seguir avisando
   * aunque la persona lleve un rato leyendo sin tocar el mouse. Pueden
   * hacerlo sin ensuciar la presencia porque esta tiene su propia señal
   * (`users.presencia_at`), que solo marca el endpoint de presencia.
   */
  respetarInactividad = true,
  /**
   * Ritmo (ms) al que seguir consultando con la pestaña OCULTA. Sin esto, el
   * sondeo se detiene del todo al cambiar de pestaña.
   *
   * Lo usa el chat: es lo que permite que el contador del título avise de un
   * mensaje mientras la persona está en otra pestaña. Puede permitírselo
   * porque la presencia tiene señal propia (`users.presencia_at`) y este
   * sondeo ya no la ensucia. Se va a un ritmo lento a propósito.
   */
  intervaloOculto?: number
) => {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ultimaActividadRef = useRef<number>(Date.now())
  // La tarea se guarda en una referencia para que cambiarla no reinicie el
  // temporizador en cada render.
  const tareaRef = useRef(tarea)
  tareaRef.current = tarea

  useEffect(() => {
    if (!habilitado) return

    const hayAlguien = () =>
      !document.hidden
      && (!respetarInactividad || (Date.now() - ultimaActividadRef.current) < MS_INACTIVIDAD)

    const sigueActivo = () =>
      !respetarInactividad || (Date.now() - ultimaActividadRef.current) < MS_INACTIVIDAD

    /**
     * ¿Toca consultar ahora?
     *
     * Con la pestaña oculta se consulta solo si se pidió seguir, y aun así
     * respetando la inactividad: los eventos de mouse no llegan a una pestaña
     * de fondo, así que el reloj sigue corriendo y quien se fue termina
     * cayendo de la lista igual.
     */
    const debeConsultar = () =>
      document.hidden ? Boolean(intervaloOculto) && sigueActivo() : hayAlguien()

    const detener = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    const arrancar = (ms: number) => {
      if (timerRef.current) return
      timerRef.current = setInterval(() => {
        // Se comprueba en cada latido: así el sondeo se apaga solo cuando la
        // persona se queda quieta, sin necesidad de un temporizador aparte.
        if (debeConsultar()) {
          tareaRef.current()
        } else {
          detener()
        }
      }, ms)
    }

    const despertar = () => {
      const estabaDormido = timerRef.current === null
      ultimaActividadRef.current = Date.now()
      if (!document.hidden && estabaDormido) {
        // Al volver, ponerse al día de inmediato: esperar al siguiente ciclo
        // haría que la pantalla se viera desactualizada justo al retomar.
        tareaRef.current()
        arrancar(intervaloMs)
      }
    }

    const alCambiarVisibilidad = () => {
      detener()
      if (document.hidden) {
        // Al pasar a segundo plano se baja el ritmo, si se pidió seguir.
        if (debeConsultar()) arrancar(intervaloOculto!)
      } else {
        tareaRef.current()
        arrancar(intervaloMs)
      }
    }

    // Primera ejecución inmediata, sin esperar un ciclo completo.
    tareaRef.current()
    if (document.hidden) {
      if (debeConsultar()) arrancar(intervaloOculto!)
    } else {
      arrancar(intervaloMs)
    }

    EVENTOS_ACTIVIDAD.forEach(e =>
      window.addEventListener(e, despertar, { passive: true })
    )
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      detener()
      EVENTOS_ACTIVIDAD.forEach(e => window.removeEventListener(e, despertar))
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [habilitado, intervaloMs, respetarInactividad, intervaloOculto])
}
