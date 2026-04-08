import { Box } from '@mui/material'

interface PdfViewerProps {
  url: string
  height?: string | number | Record<string, string>
}

export default function PdfViewer({ url, height = '85vh' }: PdfViewerProps) {
  // #toolbar=0 oculta la barra de herramientas nativa del visor PDF (descarga, impresión)
  // La descarga debe hacerse desde el botón explícito del sistema
  const src = url.includes('#') ? url : `${url}#toolbar=0&navpanes=0`
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
