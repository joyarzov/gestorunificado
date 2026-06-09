import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip,
  Alert, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Tooltip, IconButton,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ActivarIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material'
import { firmaSelloAPI } from '../../api/firmaSello'
import { FirmaSello } from '../../types'

const STORAGE_URL = '/storage/'

const FirmaSellosPage = () => {
  const navigate = useNavigate()
  const [sellos, setSellos] = useState<FirmaSello[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activando, setActivando] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState<number | null>(null)
  const [confirmActivar, setConfirmActivar] = useState<FirmaSello | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<FirmaSello | null>(null)

  const cargar = async () => {
    try {
      const res = await firmaSelloAPI.listar()
      setSellos(res.data)
    } catch {
      setError('Error al cargar los diseños de sello')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const handleActivar = async () => {
    if (!confirmActivar) return
    setActivando(confirmActivar.id)
    setConfirmActivar(null)
    try {
      await firmaSelloAPI.activar(confirmActivar.id)
      setSellos(prev => prev.map(s => ({ ...s, activo: s.id === confirmActivar.id })))
    } catch {
      setError('Error al activar el sello')
    } finally {
      setActivando(null)
    }
  }

  const handleEliminar = async () => {
    if (!confirmEliminar) return
    setEliminando(confirmEliminar.id)
    setConfirmEliminar(null)
    try {
      await firmaSelloAPI.eliminar(confirmEliminar.id)
      setSellos(prev => prev.filter(s => s.id !== confirmEliminar.id))
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al eliminar el sello')
    } finally {
      setEliminando(null)
    }
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/administracion')}>Volver</Button>
        <Typography variant="h4" fontWeight="bold">Diseños de Sello de Firma</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Solo un diseño puede estar activo. El diseño activo se usa en todas las firmas electrónicas nuevas.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/firma-sellos/nuevo')}>
          Nuevo diseño
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {sellos.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">No hay diseños creados. Crea el primero.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {sellos.map(sello => (
            <Grid item xs={12} key={sello.id}>
              <Card sx={{
                borderLeft: `4px solid ${sello.activo ? '#2DC700' : '#e0e0e0'}`,
                opacity: eliminando === sello.id ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    {/* Preview del sello */}
                    <Grid item xs={12} sm={3} md={2}>
                      {sello.preview_path ? (
                        <Box
                          component="img"
                          src={STORAGE_URL + sello.preview_path}
                          alt="Preview sello"
                          sx={{ width: '100%', maxWidth: 200, border: '1px solid #e0e0e0', borderRadius: 1 }}
                        />
                      ) : (
                        <Box sx={{
                          width: '100%', maxWidth: 200, height: 60,
                          bgcolor: sello.color_fondo || '#EBF5FF',
                          border: `2px solid ${sello.color_primario || '#0071BC'}`,
                          borderRadius: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Typography variant="caption" color="text.secondary">Sin preview</Typography>
                        </Box>
                      )}
                    </Grid>

                    {/* Info */}
                    <Grid item xs={12} sm={5} md={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="h6" fontWeight="bold">{sello.nombre}</Typography>
                        {sello.activo && (
                          <Chip label="ACTIVO" color="success" size="small" />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {sello.texto_linea1} · {sello.texto_linea2}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {sello.mostrar_logo ? 'Con logo' : 'Sin logo'} ·&nbsp;
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: sello.color_primario, border: '1px solid #ccc', display: 'inline-block' }} />
                          {sello.color_primario}
                        </Box>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Creado por {sello.creador?.nombre || '—'} el {new Date(sello.created_at).toLocaleDateString('es-CL')}
                      </Typography>
                    </Grid>

                    {/* Acciones */}
                    <Grid item xs={12} sm={4} md={4}>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'flex-start', sm: 'flex-end' }, flexWrap: 'wrap' }}>
                        <Tooltip title="Editar diseño">
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditIcon />}
                              onClick={() => navigate(`/firma-sellos/${sello.id}/editar`)}
                            >
                              Editar
                            </Button>
                          </span>
                        </Tooltip>

                        <Tooltip title={sello.activo ? 'Ya está activo' : 'Usar este diseño en nuevas firmas'}>
                          <span>
                            <Button
                              size="small"
                              variant={sello.activo ? 'outlined' : 'contained'}
                              color="success"
                              startIcon={activando === sello.id ? <CircularProgress size={16} /> : <ActivarIcon />}
                              onClick={() => !sello.activo && setConfirmActivar(sello)}
                              disabled={sello.activo || activando === sello.id}
                            >
                              {sello.activo ? 'Activo' : 'Activar'}
                            </Button>
                          </span>
                        </Tooltip>

                        <Tooltip title={sello.activo ? 'No se puede eliminar el sello activo' : 'Eliminar diseño'}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => !sello.activo && setConfirmEliminar(sello)}
                              disabled={sello.activo || eliminando === sello.id}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog confirmar activar */}
      <Dialog open={!!confirmActivar} onClose={() => setConfirmActivar(null)}>
        <DialogTitle>Activar diseño de sello</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Activar <strong>{confirmActivar?.nombre}</strong>? El sello activo actual dejará de usarse.
            Las firmas ya generadas no se modifican.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmActivar(null)}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={handleActivar}>Activar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog confirmar eliminar */}
      <Dialog open={!!confirmEliminar} onClose={() => setConfirmEliminar(null)}>
        <DialogTitle>Eliminar diseño</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Eliminar <strong>{confirmEliminar?.nombre}</strong>? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmEliminar(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleEliminar}>Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default FirmaSellosPage
