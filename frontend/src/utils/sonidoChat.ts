/**
 * Aviso sonoro de mensaje nuevo.
 *
 * Se sintetiza con Web Audio en vez de reproducir un archivo: evita sumar un
 * asset, no depende de rutas ni de la caché del navegador, y permite un tono
 * corto y discreto —esto suena en oficinas municipales con gente al lado, no
 * en una aplicación de mensajería personal.
 */

const CLAVE_SILENCIO = 'chat_silenciado'

/** ¿El usuario silenció el aviso? Se recuerda por navegador. */
export const estaSilenciado = (): boolean => {
  try {
    return localStorage.getItem(CLAVE_SILENCIO) === '1'
  } catch {
    // Navegador con el almacenamiento bloqueado: se asume con sonido.
    return false
  }
}

export const silenciar = (valor: boolean): void => {
  try {
    localStorage.setItem(CLAVE_SILENCIO, valor ? '1' : '0')
  } catch {
    // Sin almacenamiento, la preferencia dura lo que la sesión.
  }
}

let contexto: AudioContext | null = null

/**
 * Dos notas ascendentes muy breves. Falla en silencio: los navegadores
 * bloquean el audio hasta que el usuario interactúa con la página, y un aviso
 * que no suena jamás debe romper la aplicación.
 */
export const sonarMensajeNuevo = (): void => {
  if (estaSilenciado()) return

  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    if (!contexto) contexto = new Ctor()
    if (contexto.state === 'suspended') void contexto.resume()

    const ahora = contexto.currentTime
    // Sol5 y Do6: un intervalo que se reconoce sin resultar estridente.
    ;[784, 1046.5].forEach((frecuencia, i) => {
      const osc = contexto!.createOscillator()
      const vol = contexto!.createGain()
      osc.type = 'sine'
      osc.frequency.value = frecuencia
      osc.connect(vol)
      vol.connect(contexto!.destination)

      const inicio = ahora + i * 0.1
      // Envolvente suave: sin el ataque y la caída graduales se oye un "clic".
      vol.gain.setValueAtTime(0.0001, inicio)
      vol.gain.exponentialRampToValueAtTime(0.12, inicio + 0.02)
      vol.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.18)

      osc.start(inicio)
      osc.stop(inicio + 0.2)
    })
  } catch {
    // Sin audio disponible, el aviso visual (contador rojo) sigue estando.
  }
}
