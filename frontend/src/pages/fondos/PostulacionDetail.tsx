import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Assessment as EvaluarIcon,
  CheckCircle as AprobarIcon,
  Cancel as RechazarIcon,
  AttachFile as FileIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material'
import { postulacionesAPI } from '../../api/fondos'
import { Postulacion } from '../../types'
import FinanciamientoTable from '../../components/fondos/FinanciamientoTable'

const estadoConfig: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }> = {
  borrador: { label: 'Borrador', color: 'default' },
  enviada: { label: 'Enviada', color: 'info' },
  en_revision: { label: 'En Revisión', color: 'warning' },
  aprobada: { label: 'Aprobada', color: 'success' },
  rechazada: { label: 'Rechazada', color: 'error' },
}

const PostulacionDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [postulacion, setPostulacion] = useState<Postulacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Aprobar dialog
  const [aprobarOpen, setAprobarOpen] = useState(false)
  const [montoAprobado, setMontoAprobado] = useState('')
  const [obsAprobar, setObsAprobar] = useState('')
  const [aprobando, setAprobando] = useState(false)

  // Rechazar dialog
  const [rechazarOpen, setRechazarOpen] = useState(false)
  const [obsRechazar, setObsRechazar] = useState('')
  const [rechazando, setRechazando] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await postulacionesAPI.obtener(parseInt(id || '0'))
        setPostulacion(res.data)
      } catch {
        setError('Error al cargar la postulación')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [id])

  const handleAprobar = async () => {
    if (!postulacion) return
    setAprobando(true)
    try {
      const res = await postulacionesAPI.aprobar(postulacion.id, {
        monto_aprobado: parseInt(montoAprobado) || 0,
        observaciones_evaluacion: obsAprobar,
      })
      setPostulacion(res.data)
      setAprobarOpen(false)
    } catch {
      setError('Error al aprobar')
    } finally {
      setAprobando(false)
    }
  }

  const handleRechazar = async () => {
    if (!postulacion) return
    setRechazando(true)
    try {
      const res = await postulacionesAPI.rechazar(postulacion.id, {
        observaciones_evaluacion: obsRechazar,
      })
      setPostulacion(res.data)
      setRechazarOpen(false)
    } catch {
      setError('Error al rechazar')
    } finally {
      setRechazando(false)
    }
  }

  const handleDescargarAdjunto = async (adjuntoId: number, nombre: string) => {
    try {
      const blob = await postulacionesAPI.descargarAdjunto(adjuntoId)
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', nombre)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Error al descargar')
    }
  }

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monto)
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }

  if (!postulacion) {
    return <Alert severity="error">Postulación no encontrada</Alert>
  }

  const contenido = postulacion.contenido_json || {}
  const puedeEvaluar = ['enviada', 'en_revision'].includes(postulacion.estado)

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Postulación {postulacion.codigo}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {postulacion.nombre_postulante} - {postulacion.rut_postulante}
            </Typography>
          </Box>
          <Chip
            label={estadoConfig[postulacion.estado]?.label || postulacion.estado}
            color={estadoConfig[postulacion.estado]?.color || 'default'}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<PdfIcon />}
            onClick={() => window.print()}
          >
            Descargar Ficha
          </Button>
          {puedeEvaluar && (
            <>
              <Button
                variant="outlined"
                startIcon={<EvaluarIcon />}
                onClick={() => navigate(`/postulaciones/${postulacion.id}/evaluar`)}
              >
                Evaluar
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<AprobarIcon />}
                onClick={() => setAprobarOpen(true)}
              >
                Aprobar
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RechazarIcon />}
                onClick={() => setRechazarOpen(true)}
              >
                Rechazar
              </Button>
            </>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Evaluación previa */}
      {postulacion.puntaje != null && (
        <Paper sx={{ p: 3, mb: 3, bgcolor: postulacion.estado === 'aprobada' ? 'success.50' : postulacion.estado === 'rechazada' ? 'error.50' : 'info.50' }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>Evaluación</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">Puntaje</Typography>
              <Typography variant="h5" fontWeight="bold">{postulacion.puntaje}%</Typography>
            </Grid>
            {postulacion.monto_aprobado != null && (
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary">Monto Aprobado</Typography>
                <Typography variant="h5" fontWeight="bold" color="success.main">{formatMonto(postulacion.monto_aprobado)}</Typography>
              </Grid>
            )}
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">Evaluador</Typography>
              <Typography variant="body1">{postulacion.evaluador?.nombre || '-'}</Typography>
            </Grid>
          </Grid>
          {postulacion.observaciones_evaluacion && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">Observaciones:</Typography>
              <Typography variant="body1">{postulacion.observaciones_evaluacion}</Typography>
            </Box>
          )}
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Datos del Emprendedor */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Datos del Emprendedor</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Detail label="Nombre" value={postulacion.nombre_postulante} />
              <Detail label="RUT" value={postulacion.rut_postulante} />
              <Detail label="Email" value={postulacion.email_postulante} />
              <Detail label="Teléfono" value={postulacion.telefono_postulante} />
              <Detail label="Dirección" value={contenido.direccion as string} />
              <Detail label="Género" value={contenido.genero as string} />
              <Detail label="Nivel Educacional" value={contenido.nivel_educacional as string} />
              <Detail label="Pueblo Originario" value={contenido.pueblo_originario as string} />
              <Detail label="RSH Tramo" value={contenido.rsh_tramo as string} />
            </Box>
          </Paper>
        </Grid>

        {/* Datos del Emprendimiento */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Datos del Emprendimiento</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Detail label="Nombre" value={contenido.nombre_emprendimiento as string} />
              <Detail label="Rubro" value={contenido.rubro as string} />
              <Detail label="Antigüedad" value={contenido.antiguedad_negocio as string} />
              <Detail label="Dirección" value={contenido.direccion_emprendimiento as string} />
              <Detail label="Patente" value={contenido.tiene_patente as string} />
              <Detail label="Inicio Actividades" value={contenido.tiene_inicio_actividades as string} />
              <Detail label="Trabajadores" value={contenido.num_trabajadores as string} />
              <Detail label="Ventas Mensuales" value={contenido.ventas_mensuales ? formatMonto(Number(contenido.ventas_mensuales)) : undefined} />
            </Box>
          </Paper>
        </Grid>

        {/* Plan de Negocio */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Plan de Negocio</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <DetailBlock label="Descripción del Proyecto" value={contenido.descripcion_proyecto as string} />
              </Grid>
              <Grid item xs={12}>
                <DetailBlock label="Objetivo General" value={contenido.objetivo_general as string} />
              </Grid>
              <Grid item xs={12}>
                <DetailBlock label="Objetivos Específicos" value={contenido.objetivos_especificos as string} />
              </Grid>
              <Grid item xs={12}>
                <DetailBlock label="Clientes Objetivo" value={contenido.clientes_objetivo as string} />
              </Grid>
              <Grid item xs={12}>
                <DetailBlock label="Estrategia Comercial" value={contenido.estrategia_comercial as string} />
              </Grid>
              <Grid item xs={12}>
                <DetailBlock label="Innovación" value={contenido.innovacion as string} />
              </Grid>
              <Grid item xs={12}>
                <DetailBlock label="Impacto Económico" value={contenido.impacto_economico as string} />
              </Grid>
              <Grid item xs={12}>
                <DetailBlock label="Sustentabilidad" value={contenido.sustentabilidad as string} />
              </Grid>
              <Grid item xs={12}>
                <DetailBlock label="Asociatividad" value={contenido.asociatividad as string} />
              </Grid>
              <Grid item xs={12}>
                <DetailBlock label="Proveedores Locales" value={contenido.proveedores_locales as string} />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Financiamiento */}
        {postulacion.items_financiamiento && postulacion.items_financiamiento.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <FinanciamientoTable
                items={postulacion.items_financiamiento}
                onChange={() => {}}
                readOnly
              />
            </Paper>
          </Grid>
        )}

        {/* Adjuntos */}
        {postulacion.adjuntos && postulacion.adjuntos.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>Documentos Adjuntos</Typography>
              <List>
                {postulacion.adjuntos.map((adj) => (
                  <ListItem key={adj.id} divider>
                    <ListItemIcon><FileIcon /></ListItemIcon>
                    <ListItemText
                      primary={adj.nombre_archivo}
                      secondary={adj.tipo_documento.replace(/_/g, ' ')}
                    />
                    <Button
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDescargarAdjunto(adj.id, adj.nombre_archivo)}
                    >
                      Descargar
                    </Button>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Dialog Aprobar */}
      <Dialog open={aprobarOpen} onClose={() => setAprobarOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Aprobar Postulación</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Monto Aprobado ($)"
            type="number"
            value={montoAprobado}
            onChange={(e) => setMontoAprobado(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            inputProps={{ min: 0 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Observaciones"
            value={obsAprobar}
            onChange={(e) => setObsAprobar(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAprobarOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleAprobar}
            disabled={aprobando || !montoAprobado}
          >
            {aprobando ? 'Aprobando...' : 'Aprobar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Rechazar */}
      <Dialog open={rechazarOpen} onClose={() => setRechazarOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rechazar Postulación</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Motivo del Rechazo"
            value={obsRechazar}
            onChange={(e) => setObsRechazar(e.target.value)}
            sx={{ mt: 1 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRechazarOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRechazar}
            disabled={rechazando || !obsRechazar.trim()}
          >
            {rechazando ? 'Rechazando...' : 'Rechazar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

const Detail = ({ label, value }: { label: string; value?: string | null }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
    <Typography variant="body2" color="text.secondary">{label}:</Typography>
    <Typography variant="body2" fontWeight="medium">{value || '-'}</Typography>
  </Box>
)

const DetailBlock = ({ label, value }: { label: string; value?: string | null }) => (
  <Box>
    <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value || '-'}</Typography>
    </Paper>
  </Box>
)

export default PostulacionDetail
