import { Box } from '@mui/material'

interface PdfViewerProps {
  url: string
}

export default function PdfViewer({ url }: PdfViewerProps) {
  // toolbar=0 oculta barra nativa; zoom=page-fit ajusta la página al espacio disponible
  const src = url.includes('#') ? url : `${url}#toolbar=0&navpanes=0&zoom=page-fit`
  return (
    <Box
      component="iframe"
      src={src}
      sx={{
        width: '100%',
        aspectRatio: '8.5 / 11', // proporción exacta hoja carta — sin espacio negro
        border: 'none',
        borderRadius: 1,
        bgcolor: '#525659',
        display: 'block',
      }}
      title="Vista previa del documento"
    />
  )
}
