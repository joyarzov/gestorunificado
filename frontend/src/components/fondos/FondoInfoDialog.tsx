import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
} from '@mui/material'
import {
  Download as DownloadIcon,
  Edit as PostularIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { FondoConcursable } from '../../types'
import { fondosPublicoAPI } from '../../api/fondos'

interface FondoInfoDialogProps {
  open: boolean
  onClose: () => void
  fondo: FondoConcursable | null
}

const FondoInfoDialog = ({ open, onClose, fondo }: FondoInfoDialogProps) => {
  const navigate = useNavigate()
  const [descargando, setDescargando] = useState(false)

  if (!fondo) return null

  const handleDescargarBases = async () => {
    setDescargando(true)
    try {
      const blob = await fondosPublicoAPI.descargarBases(fondo.id)
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Bases_${fondo.codigo}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Las bases no están disponibles aún.')
    } finally {
      setDescargando(false)
    }
  }

  const handlePostular = () => {
    onClose()
    navigate('/fondos/postular')
  }

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monto)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" fontWeight="bold">
          {fondo.nombre}
        </Typography>
        <Chip
          label={fondo.estado === 'abierto' ? 'Postulaciones Abiertas' : 'Cerrado'}
          color={fondo.estado === 'abierto' ? 'success' : 'default'}
          size="small"
          sx={{ mt: 1 }}
        />
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {fondo.descripcion}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MoneyIcon color="primary" fontSize="small" />
            <Typography variant="body2">
              <strong>Monto máximo por proyecto:</strong> {formatMonto(fondo.monto_maximo_por_proyecto)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MoneyIcon color="primary" fontSize="small" />
            <Typography variant="body2">
              <strong>Fondo total:</strong> {formatMonto(fondo.monto_total)}
            </Typography>
          </Box>
          {fondo.fecha_apertura && fondo.fecha_cierre && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon color="primary" fontSize="small" />
              <Typography variant="body2">
                <strong>Plazo:</strong> {new Date(fondo.fecha_apertura).toLocaleDateString('es-CL')} al{' '}
                {new Date(fondo.fecha_cierre).toLocaleDateString('es-CL')}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={onClose} color="inherit">
          Cerrar
        </Button>
        <Button
          variant="outlined"
          startIcon={descargando ? <CircularProgress size={16} /> : <DownloadIcon />}
          onClick={handleDescargarBases}
          disabled={descargando}
        >
          Ver Bases
        </Button>
        {fondo.estado === 'abierto' && (
          <Button
            variant="contained"
            startIcon={<PostularIcon />}
            onClick={handlePostular}
          >
            Postular
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default FondoInfoDialog
