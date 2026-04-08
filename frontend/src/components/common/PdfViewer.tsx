import { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Box, CircularProgress, Typography, IconButton } from '@mui/material'
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
} from '@mui/icons-material'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface PdfViewerProps {
  url: string
  height?: string | number | Record<string, string>
}

export default function PdfViewer({ url, height = '85vh' }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [loadError, setLoadError] = useState(false)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPageNumber(1)
    setLoadError(false)
  }, [])

  if (loadError) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          No se pudo cargar el PDF.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: '100%',
          height,
          overflow: 'auto',
          bgcolor: '#525659',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 2,
          borderRadius: 1,
        }}
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => setLoadError(true)}
          loading={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <CircularProgress sx={{ color: 'white' }} />
            </Box>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Box key={i + 1} sx={{ mb: 2 }}>
              <Page
                pageNumber={i + 1}
                renderAnnotationLayer
                renderTextLayer
                width={Math.min(794, window.innerWidth - 80)}
              />
            </Box>
          ))}
        </Document>
      </Box>

      {numPages > 1 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
          >
            <PrevIcon />
          </IconButton>
          <Typography variant="body2">
            Página {pageNumber} de {numPages}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
          >
            <NextIcon />
          </IconButton>
        </Box>
      )}
    </Box>
  )
}
