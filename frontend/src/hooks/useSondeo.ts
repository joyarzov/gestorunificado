import { useEffect, useRef } from 'react'

/**
 * Minutos sin mover el mouse, teclear o hacer scroll tras los cuales se
 * considera que la persona dejó el puesto, aunque la pestaña siga a la vista.
 *
 * Tres minutos deja margen para leer un documento largo sin que el sistema
 * declare ausente a alguien que sí está trabajando.
 */
const MINUTOS_INACTIVIDAD = 3
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
  habilitado: boolean
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
      !document.hidden && (Date.now() - ultimaActividadRef.current) < MS_INACTIVIDAD

    const detener = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    const arrancar = () => {
      if (timerRef.current) return
      timerRef.current = setInterval(() => {
        // Se comprueba en cada latido: así el sondeo se apaga solo cuando la
        // persona se queda quieta, sin necesidad de un temporizador aparte.
        if (hayAlguien()) {
          tareaRef.current()
        } else {
          detener()
        }
      }, intervaloMs)
    }

    const despertar = () => {
      const estabaDormido = timerRef.current === null
      ultimaActividadRef.current = Date.now()
      if (!document.hidden && estabaDormido) {
        // Al volver, ponerse al día de inmediato: esperar al siguiente ciclo
        // haría que la pantalla se viera desactualizada justo al retomar.
        tareaRef.current()
        arrancar()
      }
    }

    const alCambiarVisibilidad = () => {
      if (document.hidden) {
        detener()
      } else {
        despertar()
      }
    }

    // Primera ejecución inmediata, sin esperar un ciclo completo.
    tareaRef.current()
    if (!document.hidden) arrancar()

    EVENTOS_ACTIVIDAD.forEach(e =>
      window.addEventListener(e, despertar, { passive: true })
    )
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      detener()
      EVENTOS_ACTIVIDAD.forEach(e => window.removeEventListener(e, despertar))
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [habilitado, intervaloMs])
}
