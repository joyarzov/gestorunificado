import { useState, useCallback } from 'react'
import { presenciaAPI, UsuarioPresencia } from '../api/common'
import { useSondeo } from './useSondeo'

/**
 * Cada cuánto se refresca la lista de conectados.
 *
 * Un minuto basta: la presencia no cambia a cada segundo, y con ~20
 * funcionarios es una petición por minuto y por sesión activa.
 */
const INTERVALO = 60000

/**
 * Ritmo con la pestaña en segundo plano.
 *
 * Sin esto, quien tiene la plataforma abierta en otra pestaña mientras trabaja
 * en otro sistema desaparecía de la lista, aunque estuviera en su puesto: el
 * caso más común en la municipalidad.
 *
 * Sigue sin ser un cheque en blanco. La cuenta de inactividad no se reinicia
 * mientras la pestaña está oculta —los eventos de mouse solo llegan a la
 * pestaña activa—, así que a los 15 minutos sin volver a la plataforma el
 * sondeo se corta igual y la persona cae de la lista.
 */
const INTERVALO_OCULTO = 60000

export const usePresencia = (isAuthenticated: boolean) => {
  const [usuarios, setUsuarios] = useState<UsuarioPresencia[]>([])
  const [loading, setLoading] = useState(true)

  const enLinea = usuarios.filter(u => u.estado === 'en_linea')

  const cargar = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await presenciaAPI.listar()
      if (res.success) setUsuarios(res.data.usuarios)
    } catch {
      // Silencioso: es un sondeo de fondo. Un corte de red no debe ensuciar
      // la pantalla con errores; en el siguiente ciclo se recupera solo.
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Este es el único sondeo que SÍ se detiene por inactividad: consultar la
  // lista es lo que marca la propia presencia, así que dejar de consultar es
  // exactamente lo que hace que el verde se apague al irse del puesto.
  useSondeo(cargar, INTERVALO, isAuthenticated, true, INTERVALO_OCULTO)

  return { usuarios, enLinea, totalEnLinea: enLinea.length, loading, recargar: cargar }
}
