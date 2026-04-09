import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Card, CardContent,
  Alert, CircularProgress, FormControlLabel, Switch, Divider, Chip,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Verified as FirmaIcon,
  Warning as WarnIcon,
} from '@mui/icons-material'
import { configuracionAPI } from '../../api/configuracion'

const Configuracion = () => {
  const navigate = useNavigate()
  const [simulate, setSimulate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    configuracionAPI.listar()
      .then(res => {
        const val = res.data?.firmagob_simulate?.valor
        setSimulate(val === 'true')
      })
      .catch(() => setError('Error al cargar la configuración'))
      .finally(() => setLoading(false))
  }, [])

  const handleToggleSimulate = async (checked: boolean) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await configuracionAPI.actualizar('firmagob_simulate', checked ? 'true' : 'false')
      setSimulate(checked)
      setSuccess(checked
        ? 'Modo simulación activado. Las firmas no serán legalmente válidas.'
        : 'Modo simulación desactivado. Las firmas son reales y legalmente válidas.')
    } catch {
      setError('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
      <CircularProgress />
    </Box>
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/administracion')}>Volver</Button>
        <Typography variant="h4" fontWeight="bold">Configuración del Sistema</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Sección FirmaGob */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FirmaIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">Firma Electrónica FirmaGob</Typography>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  Modo simulación
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cuando está activo, las firmas se procesan localmente sin llamar al servicio
                  FirmaGob. El documento no tendrá validez legal. Útil para pruebas.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {simulate && (
                  <Chip
                    icon={<WarnIcon />}
                    label="SIMULACIÓN ACTIVA"
                    color="warning"
                    size="small"
                  />
                )}
                <FormControlLabel
                  control={
                    <Switch
                      checked={simulate}
                      onChange={e => handleToggleSimulate(e.target.checked)}
                      disabled={saving}
                      color="warning"
                    />
                  }
                  label={saving ? <CircularProgress size={16} /> : (simulate ? 'Activada' : 'Desactivada')}
                />
              </Box>
            </Box>

            {simulate && (
              <Alert severity="warning" icon={<WarnIcon />}>
                <strong>Modo simulación activo.</strong> Las firmas generadas NO tienen validez legal.
                Desactive esta opción antes de usar el sistema en producción real.
              </Alert>
            )}

            {!simulate && (
              <Alert severity="success">
                Firma electrónica real activa. Los documentos firmados tienen validez legal mediante FirmaGob.
              </Alert>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default Configuracion
