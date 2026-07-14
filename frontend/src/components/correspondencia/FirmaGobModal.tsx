import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Alert, CircularProgress, Box,
  ToggleButtonGroup, ToggleButton, Slider,
} from '@mui/material'
import { Verified as FirmaIcon, Warning as WarnIcon, Download as DownloadIcon, Bolt as BoltIcon } from '@mui/icons-material'
import { configuracionAPI } from '../../api/configuracion'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api/axios'
import FirmaPagePreview from '../common/FirmaPagePreview'

export interface FirmaParams {
  otp: string
  firmaY: number
  firmaPage: string
  firmaCol: number
  desatendida: boolean
}

interface FirmaGobModalProps {
  open: boolean
  titulo: string
  descripcion: string
  loading: boolean
  error: string | null
  onFirmar: (params: FirmaParams) => void
  onCancel?: () => void
  pdfUrl?: string | null
}

const FirmaGobModal = ({
  open, titulo, descripcion, loading, error, onFirmar, onCancel, pdfUrl,
}: FirmaGobModalProps) => {
  const { user } = useAuth()
  // La capacidad y el modo por defecto pertenecen al firmante real (el titular
  // del certificado). Solo el Alcalde con la firma desatendida habilitada ve el toggle.
  const desatendidaHabilitada = !!user?.firma_desatendida_habilitada

  const [otp, setOtp] = useState('')
  const [desatendida, setDesatendida] = useState(false)
  const [firmaYPos, setFirmaYPos] = useState(27) // slider 0-100; default = sobre la línea de firma (bloque fijo)
  const [firmaPageMode, setFirmaPageMode] = useState<'LAST' | 'FIRST'>('LAST')
  const [firmaCol, setFirmaCol] = useState<0 | 1 | 2>(0) // default izquierda (donde está el bloque de firma)
  const [simulate, setSimulate] = useState(false)
  const [selloUrl, setSelloUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setOtp('')
    // Preseleccionar el modo que el usuario dejó guardado (persistido en el backend
    // tras cada firma). Sin habilitación, siempre atendida.
    setDesatendida(desatendidaHabilitada && user?.firma_modo_preferido === 'desatendido')
    setFirmaYPos(27)
    setFirmaPageMode('LAST')
    setFirmaCol(0)
    configuracionAPI.firmagobEstado()
      .then(res => setSimulate(res.data.simulate))
      .catch(() => setSimulate(false))

    // Miniatura REAL del sello del firmante (con su nombre/cargo/RUT),
    // para que la vista previa muestre exactamente cómo quedará.
    let url: string | null = null
    api.get('/firma-sellos/mi-sello', { responseType: 'blob' })
      .then((res) => {
        url = URL.createObjectURL(res.data as Blob)
        setSelloUrl(url)
      })
      .catch(() => setSelloUrl(null)) // respaldo: recuadro azul genérico
    return () => {
      if (url) URL.revokeObjectURL(url)
      setSelloUrl(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, desatendidaHabilitada])

  // Con firma desatendida no se pide OTP; con atendida se exigen los 6 dígitos.
  const puedeFirmar = desatendida || otp.length === 6

  const handleSubmit = () => {
    if (!puedeFirmar) return
    const firmaY = Math.round(10 + (firmaYPos / 100) * 702)
    const firmaPage = firmaPageMode === 'LAST' ? 'LAST' : '1'
    onFirmar({ otp: desatendida ? '' : otp, firmaY, firmaPage, firmaCol, desatendida })
  }

  return (
    <Dialog
      open={open}
      maxWidth="lg"
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

        {/* Tipo de firma: solo si el usuario tiene la firma desatendida habilitada.
            La desatendida omite el OTP; la posición/altura del sello se mantienen igual. */}
        {desatendidaHabilitada && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Tipo de firma
            </Typography>
            <ToggleButtonGroup
              value={desatendida ? 'desatendida' : 'atendida'}
              exclusive
              onChange={(_, v) => { if (v) setDesatendida(v === 'desatendida') }}
              size="small"
              color="primary"
            >
              <ToggleButton value="atendida" sx={{ fontSize: 12, px: 2 }}>
                Con código OTP
              </ToggleButton>
              <ToggleButton value="desatendida" sx={{ fontSize: 12, px: 2 }}>
                <BoltIcon sx={{ fontSize: 16, mr: 0.5 }} /> Firma desatendida
              </ToggleButton>
            </ToggleButtonGroup>
            {desatendida && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Firmará sin ingresar código OTP. Esta preferencia queda guardada para las próximas firmas.
              </Typography>
            )}
          </Box>
        )}

        {/* Selector de posición del sello */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="medium" sx={{ mb: 1.5 }}>
            Posición del sello de firma
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>

            {/* Preview + descarga del borrador (temporal, para revisión) */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <FirmaPagePreview
                pdfUrl={pdfUrl}
                firmaYPos={firmaYPos}
                existingFirmas={[]}
                newRow={0}
                newCol={firmaCol}
                selloUrl={selloUrl}
                previewPage={firmaPageMode === 'FIRST' ? 'first' : 'last'}
              />
              {pdfUrl && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                  component="a"
                  href={pdfUrl}
                  download="borrador-providencia.pdf"
                  sx={{ fontSize: 11, textTransform: 'none', py: 0.3 }}
                >
                  Descargar borrador
                </Button>
              )}
            </Box>

            {/* Controles */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Página */}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Página
                </Typography>
                <ToggleButtonGroup
                  value={firmaPageMode}
                  exclusive
                  onChange={(_, v) => v && setFirmaPageMode(v)}
                  size="small"
                >
                  <ToggleButton value="LAST" sx={{ fontSize: 11, px: 1 }}>Última</ToggleButton>
                  <ToggleButton value="FIRST" sx={{ fontSize: 11, px: 1 }}>Pág. 1</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Altura */}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Altura del sello
                </Typography>
                <Box sx={{ px: 1 }}>
                  <Slider
                    value={firmaYPos}
                    onChange={(_, v) => setFirmaYPos(v as number)}
                    min={0}
                    max={100}
                    size="small"
                    marks={[
                      { value: 0,   label: 'Inferior' },
                      { value: 100, label: 'Superior' },
                    ]}
                    sx={{ '& .MuiSlider-markLabel': { fontSize: 10 } }}
                  />
                </Box>
              </Box>

              {/* Columna */}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Posición horizontal
                </Typography>
                <ToggleButtonGroup
                  value={firmaCol}
                  exclusive
                  onChange={(_, v) => v !== null && setFirmaCol(v)}
                  size="small"
                >
                  <ToggleButton value={0} sx={{ fontSize: 11, px: 1.5 }}>Izquierda</ToggleButton>
                  <ToggleButton value={1} sx={{ fontSize: 11, px: 1.5 }}>Centro</ToggleButton>
                  <ToggleButton value={2} sx={{ fontSize: 11, px: 1.5 }}>Derecha</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* OTP: solo en firma atendida */}
              {!desatendida && (
                <TextField
                  label="Código OTP (Google Authenticator)"
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
              )}
            </Box>
          </Box>
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
          disabled={loading || !puedeFirmar}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <FirmaIcon />}
        >
          {loading ? 'Firmando...' : simulate ? 'Firmar (simulado)' : 'Firmar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default FirmaGobModal
