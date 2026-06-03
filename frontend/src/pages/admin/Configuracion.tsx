import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Card, CardContent,
  Alert, CircularProgress, FormControlLabel, Switch, Divider, Chip,
  TextField, MenuItem, Grid,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Verified as FirmaIcon,
  Warning as WarnIcon,
  Email as MailIcon,
  Send as SendIcon,
  Save as SaveIcon,
} from '@mui/icons-material'
import { configuracionAPI } from '../../api/configuracion'

const Configuracion = () => {
  const navigate = useNavigate()
  const [simulate, setSimulate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Configuración SMTP
  const MAIL_KEYS = ['mail_host', 'mail_port', 'mail_username', 'mail_password', 'mail_encryption', 'mail_from_address', 'mail_from_name'] as const
  type MailKey = typeof MAIL_KEYS[number]
  const [mail, setMail] = useState<Record<MailKey, string>>({
    mail_host: '', mail_port: '', mail_username: '', mail_password: '',
    mail_encryption: '', mail_from_address: '', mail_from_name: '',
  })
  const [mailSaving, setMailSaving] = useState(false)
  const [mailTesting, setMailTesting] = useState(false)

  useEffect(() => {
    configuracionAPI.listar()
      .then(res => {
        const data = res.data || {}
        setSimulate(data.firmagob_simulate?.valor === 'true')
        const next = {} as Record<MailKey, string>
        MAIL_KEYS.forEach(k => { next[k] = data[k]?.valor ?? '' })
        setMail(next)
      })
      .catch(() => setError('Error al cargar la configuración'))
      .finally(() => setLoading(false))
  }, [])

  const setMailField = (k: MailKey, v: string) => setMail(prev => ({ ...prev, [k]: v }))

  const handleSaveMail = async () => {
    setMailSaving(true); setError(null); setSuccess(null)
    try {
      for (const k of MAIL_KEYS) {
        // No reenviar la contraseña si quedó enmascarada (sin cambios)
        if (k === 'mail_password' && (mail[k] === '********' || mail[k] === '')) continue
        await configuracionAPI.actualizar(k, mail[k])
      }
      setSuccess('Configuración de correo guardada. Aplica de inmediato a los próximos envíos.')
      if (mail.mail_password && mail.mail_password !== '********') {
        setMail(prev => ({ ...prev, mail_password: '********' }))
      }
    } catch {
      setError('Error al guardar la configuración de correo')
    } finally {
      setMailSaving(false)
    }
  }

  const handleTestMail = async () => {
    setMailTesting(true); setError(null); setSuccess(null)
    try {
      const res = await configuracionAPI.probarCorreo()
      setSuccess(res.message || 'Correo de prueba enviado')
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((e as any)?.response?.data?.message || 'Error al enviar el correo de prueba')
    } finally {
      setMailTesting(false)
    }
  }

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

      {/* Sección Correo / SMTP */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <MailIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">Notificaciones por correo (SMTP)</Typography>
          </Box>
          <Divider sx={{ mb: 3 }} />

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Servidor de correo usado para enviar las notificaciones a los funcionarios. Si dejas un campo
            vacío, se usa el valor del servidor (.env). La contraseña no se muestra por seguridad: déjala
            con <code>********</code> para mantenerla.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField fullWidth label="Servidor (host)" value={mail.mail_host}
                onChange={e => setMailField('mail_host', e.target.value)} placeholder="mail.australbyte.cl" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Puerto" value={mail.mail_port}
                onChange={e => setMailField('mail_port', e.target.value)} placeholder="465" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Usuario" value={mail.mail_username}
                onChange={e => setMailField('mail_username', e.target.value)} placeholder="noreply@australbyte.cl" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="password" label="Contraseña" value={mail.mail_password}
                onChange={e => setMailField('mail_password', e.target.value)}
                autoComplete="new-password" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth select label="Cifrado" value={mail.mail_encryption || ''}
                onChange={e => setMailField('mail_encryption', e.target.value)}>
                <MenuItem value="ssl">SSL (465)</MenuItem>
                <MenuItem value="tls">TLS (587)</MenuItem>
                <MenuItem value="">Ninguno</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Remitente (From)" value={mail.mail_from_address}
                onChange={e => setMailField('mail_from_address', e.target.value)} placeholder="noreply@australbyte.cl" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Nombre remitente" value={mail.mail_from_name}
                onChange={e => setMailField('mail_from_name', e.target.value)} placeholder="Gestor Municipal" />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={mailSaving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSaveMail} disabled={mailSaving}>
              Guardar configuración
            </Button>
            <Button variant="outlined" startIcon={mailTesting ? <CircularProgress size={16} /> : <SendIcon />}
              onClick={handleTestMail} disabled={mailTesting}>
              Enviar correo de prueba
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            El correo de prueba se envía a tu propia dirección registrada.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}

export default Configuracion
