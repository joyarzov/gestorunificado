import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Alert, CircularProgress, Box,
} from '@mui/material'
import { Verified as FirmaIcon, Warning as WarnIcon } from '@mui/icons-material'
import { configuracionAPI } from '../../api/configuracion'

interface FirmaGobModalProps {
  open: boolean
  titulo: string
  descripcion: string
  loading: boolean
  error: string | null
  onFirmar: (otp: string) => void
  onCancel?: () => void
}

const FirmaGobModal = ({
  open, titulo, descripcion, loading, error, onFirmar, onCancel,
}: FirmaGobModalProps) => {
  const [otp, setOtp] = useState('')
  const [simulate, setSimulate] = useState(false)

  // Limpiar OTP y consultar estado simulación al abrir
  useEffect(() => {
    if (!open) return
    setOtp('')
    configuracionAPI.firmagobEstado()
      .then(res => setSimulate(res.data.simulate))
      .catch(() => setSimulate(false))
  }, [open])

  const handleSubmit = () => {
    if (otp.length === 6) onFirmar(otp)
  }

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown={!onCancel}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FirmaIcon color={simulate ? 'warning' : 'primary'} />
        {titulo}
      </DialogTitle>
      <DialogContent>
        {simulate && (
          <Alert severity="warning" icon={<WarnIcon />} sx={{ mb: 2 }}>
            <strong>Modo simulación activo.</strong> Esta firma NO tiene validez legal.
            El documento será procesado igualmente, pero sin firma electrónica real.
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {descripcion}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            label="Código OTP"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            fullWidth
            autoFocus
            disabled={loading}
            inputProps={{ inputMode: 'numeric', maxLength: 6 }}
            placeholder="000000"
            helperText="Ingrese el código de 6 dígitos de Google Authenticator"
            onKeyDown={e => e.key === 'Enter' && otp.length === 6 && !loading && handleSubmit()}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        {onCancel && (
          <Button onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button
          variant="contained"
          color={simulate ? 'warning' : 'primary'}
          onClick={handleSubmit}
          disabled={loading || otp.length !== 6}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <FirmaIcon />}
        >
          {loading ? 'Firmando...' : simulate ? 'Firmar (simulado)' : 'Firmar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default FirmaGobModal
