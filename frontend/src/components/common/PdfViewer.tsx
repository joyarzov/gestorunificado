import { Box } from '@mui/material'

interface PdfViewerProps {
  url: string
  height?: string | number | Record<string, string>
}

export default function PdfViewer({ url, height = '85vh' }: PdfViewerProps) {
  // toolbar=0 oculta barra nativa; zoom=page-fit muestra la página completa sin scroll interno
  const src = url.includes('#') ? url : `${url}#toolbar=0&navpanes=0&zoom=page-fit`
  return (
    <Box
      component="iframe"
      src={src}
      sx={{
        width: '100%',
        height,
        border: 'none',
        borderRadius: 1,
        bgcolor: '#525659',
      }}
      title="Vista previa del documento"
    />
  )
}
