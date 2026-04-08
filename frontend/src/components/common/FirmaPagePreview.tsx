import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Box, Typography } from '@mui/material'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface FirmaPagePreviewProps {
  pdfUrl: string | null
  pageMode: 'LAST' | 'FIRST' | 'NUM'
  pageNum: number
  firmaYPos: number
  existingFirmas: Array<{
    col: number
    firmaY: number
    nombre: string
  }>
  newRow: number
  newCol: number
}

const PAGE_W_PT = 612
const PAGE_H_PT = 792
const STAMP_W_PT = 160 // (612 - 71left - 57right) / 3 ≈ 160pt per column
const STAMP_H_PT = 70
const PREVIEW_W_PX = 230

const scale = PREVIEW_W_PX / PAGE_W_PT
const previewH = Math.round(PAGE_H_PT * scale)

const colXPx = [71, 233, 395].map(x => Math.round(x * scale)) // aligned with 2.5cm left margin
const stampW = Math.round(STAMP_W_PT * scale)
const stampH = Math.round(STAMP_H_PT * scale)

function llyToCssTop(lly: number): number {
  return Math.round(previewH - lly * scale - stampH)
}

export default function FirmaPagePreview({
  pdfUrl,
  pageMode,
  pageNum,
  firmaYPos,
  existingFirmas,
  newRow,
  newCol,
}: FirmaPagePreviewProps) {
  const [numPages, setNumPages] = useState<number>(0)

  // Determine which page to render
  let targetPage = 1
  if (pageMode === 'LAST') {
    targetPage = numPages > 0 ? numPages : 1
  } else if (pageMode === 'FIRST') {
    targetPage = 1
  } else {
    targetPage = pageNum
  }

  // Calculate new stamp position
  const newFirmaY = Math.round(10 + (firmaYPos / 100) * 702)
  const newLly = newFirmaY + newRow * 80
  const newCssTop = llyToCssTop(newLly)
  const newCssLeft = colXPx[newCol]

  return (
    <Box sx={{ flexShrink: 0 }}>
      <Box
        sx={{
          width: PREVIEW_W_PX,
          height: previewH,
          border: '1.5px solid',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* PDF background or simulated page */}
        {pdfUrl ? (
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={null}
            error={null}
          >
            <Page
              pageNumber={targetPage}
              width={PREVIEW_W_PX}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          </Document>
        ) : (
          <Box sx={{ p: '12px 14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {[80, 65, 75, 50, 70, 60, 80, 55, 72, 48, 68, 58].map((w, i) => (
              <Box
                key={i}
                sx={{ height: 2.5, bgcolor: 'grey.200', borderRadius: 1, width: `${w}%` }}
              />
            ))}
          </Box>
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

        {/* New stamp (blue semi-transparent) */}
        <Box
          sx={{
            position: 'absolute',
            left: newCssLeft,
            top: newCssTop,
            width: stampW,
            height: stampH,
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
