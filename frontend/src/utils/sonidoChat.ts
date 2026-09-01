/**
 * Aviso sonoro de mensaje nuevo.
 *
 * Se sintetiza con Web Audio en vez de reproducir un archivo: evita sumar un
 * asset, no depende de rutas ni de la caché del navegador, y permite un tono
 * corto y discreto —esto suena en oficinas municipales con gente al lado, no
 * en una aplicación de mensajería personal.
 *
 * ⚠️ La parte delicada es la política de reproducción automática. Los
 * navegadores crean el AudioContext en estado "suspended" y solo lo dejan
 * reanudar dentro de un gesto real del usuario (un clic, una tecla). Si se
 * intenta sonar desde un temporizador —que es justo lo que hace el sondeo del
 * chat—, el contexto sigue suspendido, `currentTime` está congelado y los
 * osciladores quedan programados en un instante que nunca llega: no se oye
 * nada y tampoco hay error.
 *
 * Por eso el contexto se desbloquea en el PRIMER gesto del usuario sobre la
 * página (ver `prepararAudio`), mucho antes de que llegue el primer mensaje.
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
let listo = false

const crearContexto = (): AudioContext | null => {
  try {
    const Ctor = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!contexto) contexto = new Ctor()
    return contexto
  } catch {
    return null
  }
}

/** Programa las dos notas. Asume el contexto ya reanudado. */
const emitir = (ctx: AudioContext): void => {
  const ahora = ctx.currentTime
  // Sol5 y Do6: un intervalo que se reconoce sin resultar estridente.
  ;[784, 1046.5].forEach((frecuencia, i) => {
    const osc = ctx.createOscillator()
    const vol = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frecuencia
    osc.connect(vol)
    vol.connect(ctx.destination)

    const inicio = ahora + i * 0.1
    // Envolvente suave: sin el ataque y la caída graduales se oye un "clic".
    vol.gain.setValueAtTime(0.0001, inicio)
    vol.gain.exponentialRampToValueAtTime(0.12, inicio + 0.02)
    vol.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.18)

    osc.start(inicio)
    osc.stop(inicio + 0.2)
  })
}

/**
 * Deja el audio habilitado aprovechando el primer gesto del usuario.
 *
 * Se llama una vez al montar la aplicación: queda a la espera de un clic o una
 * tecla, reanuda el contexto en ese instante —dentro del gesto, que es cuando
 * el navegador lo permite— y se retira. A partir de ahí, sonar desde un
 * temporizador funciona.
 */
export const prepararAudio = (): (() => void) => {
  const desbloquear = () => {
    const ctx = crearContexto()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => { listo = true }).catch(() => { /* sin audio */ })
    } else {
      listo = true
    }
    quitar()
  }

  const quitar = () => {
    document.removeEventListener('click', desbloquear)
    document.removeEventListener('keydown', desbloquear)
    document.removeEventListener('touchstart', desbloquear)
  }

  document.addEventListener('click', desbloquear)
  document.addEventListener('keydown', desbloquear)
  document.addEventListener('touchstart', desbloquear)

  return quitar
}

/**
 * Suena el aviso. Falla en silencio: un aviso que no se puede reproducir jamás
 * debe romper la aplicación, y el contador rojo sigue estando.
 *
 * @param forzar Ignora el silenciado. Se usa para la prueba manual del botón,
 *               que además ocurre dentro de un clic y por tanto siempre suena.
 */
export const sonarMensajeNuevo = (forzar = false): void => {
  if (!forzar && estaSilenciado()) return

  const ctx = crearContexto()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    // Todavía sin gesto previo: se intenta reanudar y se emite DESPUÉS. Antes
    // se emitía sin esperar y las notas se perdían contra un reloj detenido.
    ctx.resume().then(() => { listo = true; emitir(ctx) }).catch(() => { /* sin audio */ })
    return
  }

  listo = true
  try {
    emitir(ctx)
  } catch {
    // Sin audio disponible, el aviso visual sigue estando.
  }
}

/** ¿El navegador ya dejó reproducir sonido? Para poder avisarlo en la interfaz. */
export const audioListo = (): boolean => listo
