import { Box } from '@mui/material'
import { CORPORATE_COLORS } from '../../theme'

interface CorporateColorBarProps {
  height?: number
  width?: string
  borderRadius?: number
}

const BAR_COLORS = [
  CORPORATE_COLORS.barYellowGreen,
  CORPORATE_COLORS.barGreen,
  CORPORATE_COLORS.barMagenta,
  CORPORATE_COLORS.barLightBlue,
  CORPORATE_COLORS.barOrange,
]

const CorporateColorBar = ({ height = 6, width = '100%', borderRadius = 0 }: CorporateColorBarProps) => (
  <Box
    sx={{
      display: 'flex',
      width,
      height,
      borderRadius: borderRadius ? `${borderRadius}px ${borderRadius}px 0 0` : 0,
      overflow: 'hidden',
      flexShrink: 0,
    }}
  >
    {BAR_COLORS.map((color, index) => (
      <Box
        key={index}
        sx={{
          flex: 1,
          bgcolor: color,
        }}
      />
    ))}
  </Box>
)

export default CorporateColorBar
