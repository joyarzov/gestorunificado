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

  // El sondeo se detiene solo cuando la pestaña deja de estar a la vista o
  // cuando nadie toca el equipo: de eso depende que "en línea" signifique algo.
  useSondeo(cargar, INTERVALO, isAuthenticated)

  return { usuarios, enLinea, totalEnLinea: enLinea.length, loading, recargar: cargar }
}
