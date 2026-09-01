import { useEffect, useRef } from 'react'

/**
 * Antepone el contador de mensajes sin leer al título de la pestaña:
 * "(2) Correspondencia — Municipalidad…".
 *
 * Es el aviso para cuando la persona está en OTRA pestaña del navegador: no se
 * ve el aviso flotante, pero sí la barra de pestañas. Funciona porque el
 * sondeo del chat sigue corriendo en segundo plano, a ritmo lento.
 */
export const useTituloPestana = (cantidad: number) => {
  // El título de la página tal como venía, para poder devolverlo intacto.
  const originalRef = useRef<string | null>(null)

  useEffect(() => {
    if (originalRef.current === null) {
      originalRef.current = document.title.replace(/^\(\d+\)\s*/, '')
    }
    const base = originalRef.current

    document.title = cantidad > 0 ? `(${cantidad}) ${base}` : base
  }, [cantidad])

  // Al desmontar (cierre de sesión, por ejemplo) el título vuelve a lo que era.
  useEffect(() => () => {
    if (originalRef.current !== null) document.title = originalRef.current
  }, [])
}
