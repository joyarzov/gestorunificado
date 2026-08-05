import { useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// El PDF se renderiza a un <canvas> con pdf.js: mismo resultado en todos los
// navegadores, sin los controles flotantes del visor nativo y con la página
// alineada 1:1 con las coordenadas del sello.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export interface TamanoPagina {
  /** Ancho de la página en puntos PDF. */
  w: number
  /** Alto de la página en puntos PDF. */
  h: number
}

export interface FirmaPagePreviewProps {
  pdfUrl?: string | null
  firmaYPos: number
  existingFirmas: Array<{
    col: number
    firmaY: number
    nombre: string
  }>
  newRow: number
  newCol: number
  /** Miniatura PNG del sello real del firmante (endpoint /firma-sellos/mi-sello). */
  selloUrl?: string | null
  /** Página a previsualizar (la misma donde irá el sello). */
  previewPage?: 'first' | 'last' | number
  /** Tamaño del sello en % (100 = estándar). Se refleja en vivo en la vista previa. */
  escala?: number
  /**
   * Tamaño real (en puntos) de la página previsualizada. El padre lo necesita
   * para calcular las coordenadas del sello con `calcularRectFirma`: un PDF
   * subido puede ser A4, oficio o un escaneo con caja enorme, no solo carta.
   */
  onPageSize?: (size: TamanoPagina) => void
}

/** Página carta: el tamaño que genera la propia plataforma y el respaldo si el PDF no carga. */
export const PAGINA_CARTA: TamanoPagina = { w: 612, h: 792 }

// Geometría del sello expresada en FRACCIONES de la página, no en puntos fijos.
// Con carta (612x792) da exactamente los valores históricos (margen 10pt, rango
// 702pt, columnas en 71/233/395 con 160pt de ancho, alto de caja 70pt); con
// cualquier otro tamaño de página escala en proporción, que es lo que hace que
// la vista previa y el PDF firmado coincidan.
const MARGEN_INF_REL = 10 / 792
const RANGO_Y_REL = 702 / 792
const STAMP_H_REL = 70 / 792
const COL_X_REL = [71 / 612, 233 / 612, 395 / 612]
const COL_W_REL = 160 / 612
const MARGEN_DER_REL = 57 / 612 // margen derecho del documento (2 cm)
const ROW_OFFSET_REL = 80 / 792

const PREVIEW_W_PX = 442 // +30%: más protagonismo al documento frente a los controles
const PREVIEW_H_MAX_PX = Math.round(PAGINA_CARTA.h * (PREVIEW_W_PX / PAGINA_CARTA.w))

export interface RectFirma {
  /** Coordenada X izquierda del sello, en puntos de la página. */
  llx: number
  /** Borde INFERIOR del sello (lo que el backend recibe como `firma_y`). */
  lly: number
  urx: number
  ury: number
}

/**
 * Tamaño del sello en % del ancho estándar (100 = 160pt en carta ≈ 5,6 cm).
 * Lo fija la administración en Admin → Configuración; el firmante no lo elige.
 */
export const ESCALA_MIN = 80
export const ESCALA_MAX = 200
export const ESCALA_POR_DEFECTO = 100

/** Normaliza el tamaño que llega del backend (política de la administración). */
export function normalizarEscala(valor: unknown): number {
  const escala = Number(valor)
  if (!escala || Number.isNaN(escala)) return ESCALA_POR_DEFECTO
  return Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, Math.round(escala)))
}

/**
 * Traduce la posición elegida en el deslizador (0-100), la columna y el tamaño
 * a coordenadas PDF de la página REAL. Usada por la vista previa y por quien
 * dispara la firma, para que ambos hablen exactamente de la misma caja.
 *
 * Solo se escala el ANCHO: FirmaGob deriva el alto del aspecto real del sello,
 * así que la imagen crece proporcionalmente sin deformarse.
 */
export function calcularRectFirma(
  page: TamanoPagina,
  firmaYPos: number,
  col: number,
  escala = ESCALA_POR_DEFECTO,
  row = 0,
): RectFirma {
  const lly = Math.round(
    (MARGEN_INF_REL + (firmaYPos / 100) * RANGO_Y_REL + row * ROW_OFFSET_REL) * page.h,
  )
  // El sello no puede pasarse de los márgenes del documento: si al agrandarlo se
  // sale por la derecha, se corre hacia la izquierda en vez de quedar cortado.
  const bordeIzq = Math.round(COL_X_REL[0] * page.w)
  const bordeDer = Math.round((1 - MARGEN_DER_REL) * page.w)
  const ancho = Math.min(Math.round(COL_W_REL * page.w * (escala / 100)), bordeDer - bordeIzq)
  const llx = Math.min(Math.round(COL_X_REL[col % 3] * page.w), bordeDer - ancho)

  return {
    llx,
    lly,
    urx: llx + ancho,
    ury: Math.round(lly + STAMP_H_REL * page.h * (escala / 100)),
  }
}

export default function FirmaPagePreview({
  pdfUrl,
  firmaYPos,
  existingFirmas,
  newRow,
  newCol,
  selloUrl,
  previewPage = 'last',
  onPageSize,
  escala = ESCALA_POR_DEFECTO,
}: FirmaPagePreviewProps) {
  // Render de la página elegida del PDF en el canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdfListo, setPdfListo] = useState(false)
  const [pageSize, setPageSize] = useState<TamanoPagina>(PAGINA_CARTA)

  // El callback se guarda en una ref para que el efecto de render no dependa de
  // su identidad (el padre suele pasar una lambda nueva en cada render).
  const onPageSizeRef = useRef(onPageSize)
  onPageSizeRef.current = onPageSize

  useEffect(() => {
    let cancelado = false
    setPdfListo(false)
    if (!pdfUrl) {
      setPageSize(PAGINA_CARTA)
      onPageSizeRef.current?.(PAGINA_CARTA)
      return
    }

    ;(async () => {
      try {
        const doc = await pdfjsLib.getDocument(pdfUrl).promise
        const pagina = previewPage === 'last'
          ? doc.numPages
          : previewPage === 'first'
            ? 1
            : Math.min(Math.max(1, previewPage), doc.numPages)
        const page = await doc.getPage(pagina)

        const dpr = window.devicePixelRatio || 1
        // El viewport a escala 1 ya viene con la rotación de la página aplicada:
        // es el tamaño que ve el lector y sobre el que se posiciona el sello.
        const base = page.getViewport({ scale: 1 })
        if (cancelado) return
        const tamano = { w: base.width, h: base.height }
        setPageSize(tamano)
        onPageSizeRef.current?.(tamano)

        const escalaPreview = Math.min(PREVIEW_W_PX / base.width, PREVIEW_H_MAX_PX / base.height)
        const viewport = page.getViewport({ scale: escalaPreview * dpr })

        const canvas = canvasRef.current
        if (!canvas || cancelado) return
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        if (!cancelado) setPdfListo(true)
      } catch {
        // queda el fondo simulado de respaldo, con geometría carta
        if (!cancelado) {
          setPageSize(PAGINA_CARTA)
          onPageSizeRef.current?.(PAGINA_CARTA)
        }
      }
    })()

    return () => { cancelado = true }
  }, [pdfUrl, previewPage])

  // Escala de la vista previa: la página completa cabe dentro del recuadro sin
  // deformarse, sea carta, A4, oficio o apaisada.
  const scale = Math.min(PREVIEW_W_PX / pageSize.w, PREVIEW_H_MAX_PX / pageSize.h)
  const previewW = Math.round(pageSize.w * scale)
  const previewH = Math.round(pageSize.h * scale)
  const stampW = Math.round(COL_W_REL * pageSize.w * scale)
  const stampH = Math.round(STAMP_H_REL * pageSize.h * scale)
  const colXPx = COL_X_REL.map(x => Math.round(x * pageSize.w * scale))

  const llyToCssTop = (lly: number, altoCaja = stampH) =>
    Math.round(previewH - lly * scale - altoCaja)

  // Posición y tamaño del sello nuevo, calculados con la MISMA función que usa
  // el padre al firmar: lo que se ve aquí es lo que se manda a FirmaGob.
  const nuevoRect = calcularRectFirma(pageSize, firmaYPos, newCol, escala, newRow)
  const newStampW = Math.round((nuevoRect.urx - nuevoRect.llx) * scale)
  const newStampH = Math.round((nuevoRect.ury - nuevoRect.lly) * scale)
  const newCssTop = llyToCssTop(nuevoRect.lly, newStampH)
  const newCssLeft = Math.round(nuevoRect.llx * scale)

  return (
    <Box sx={{ flexShrink: 0 }}>
      <Box sx={{ width: PREVIEW_W_PX, display: 'flex', justifyContent: 'center' }}>
        <Box
          sx={{
            width: previewW,
            height: previewH,
            border: '1.5px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'white',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Fondo simulado (visible mientras carga el PDF o si falla) */}
          {!pdfListo && (
            <Box sx={{ p: '12px 14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[80, 65, 75, 50, 70, 60, 80, 55, 72, 48, 68, 58].map((w, i) => (
                <Box key={i} sx={{ height: 2.5, bgcolor: 'grey.200', borderRadius: 1, width: `${w}%` }} />
              ))}
            </Box>
          )}

          {/* Página real del documento */}
          {pdfUrl && (
            <Box
              component="canvas"
              ref={canvasRef}
              sx={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%',
                height: '100%',
                display: pdfListo ? 'block' : 'none',
              }}
            />
          )}

          {/* Existing firm stamps (grey semi-transparent) */}
          {existingFirmas.map((f, i) => (
            <Box
              key={i}
              title={f.nombre}
              sx={{
                position: 'absolute',
                left: colXPx[f.col % 3],
                top: llyToCssTop(f.firmaY),
                width: stampW,
                height: stampH,
                bgcolor: 'rgba(100, 100, 100, 0.45)',
                border: '1px solid rgba(80, 80, 80, 0.5)',
                borderRadius: '2px',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {f.nombre && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 7,
                    color: 'white',
                    textAlign: 'center',
                    lineHeight: 1.1,
                    px: '2px',
                    overflow: 'hidden',
                    maxWidth: '100%',
                  }}
                >
                  {f.nombre}
                </Typography>
              )}
            </Box>
          ))}

          {/* Sello nuevo: miniatura REAL del sello si está disponible; si no,
              el recuadro azul de respaldo. Anclado por su borde inferior (lly),
              igual que lo posiciona FirmaGob en el PDF. */}
          {selloUrl ? (
            <Box
              sx={{
                position: 'absolute',
                left: newCssLeft,
                top: newCssTop,
                width: newStampW,
                height: newStampH,
                transition: 'all 0.15s ease',
                pointerEvents: 'none',
              }}
            >
              <Box
                component="img"
                src={selloUrl}
                alt="Tu sello de firma"
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  outline: '1.5px dashed rgba(0, 113, 188, 0.85)',
                  outlineOffset: 1,
                  borderRadius: '1px',
                  filter: 'drop-shadow(0 0 1px rgba(0,0,0,.2))',
                }}
              />
            </Box>
          ) : (
            <Box
              sx={{
                position: 'absolute',
                left: newCssLeft,
                top: newCssTop,
                width: newStampW,
                height: newStampH,
                bgcolor: 'rgba(0, 113, 188, 0.55)',
                border: '1px solid rgba(0, 90, 150, 0.7)',
                borderRadius: '2px',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontSize: 7, color: 'white', textAlign: 'center', lineHeight: 1.1, px: '2px' }}
              >
                Tu firma
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        align="center"
        sx={{ mt: 0.5 }}
      >
        Vista previa
      </Typography>
    </Box>
  )
}
