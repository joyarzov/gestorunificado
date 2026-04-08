import { Box } from '@mui/material'

interface PdfViewerProps {
  url: string
  height?: string | number | Record<string, string>
}

export default function PdfViewer({ url, height = '85vh' }: PdfViewerProps) {
  return (
    <Box
      component="iframe"
      src={url}
      sx={{
        width: '100%',
        height,
        border: 'none',
        borderRadius: 1,
        bgcolor: '#525659',
      }}
      title="Vista PDF"
    />
  )
}
