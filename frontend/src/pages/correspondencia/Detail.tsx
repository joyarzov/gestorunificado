import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  AttachFile as AttachIcon,
  Send as DerivacionIcon,
  History as HistoryIcon,
} from '@mui/icons-material'
import { correspondenciaAPI } from '../../api/correspondencia'
import { Correspondencia } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'

const estadoColors: Record<string, 'warning' | 'info' | 'success'> = {
  pendiente: 'warning',
  en_proceso: 'info',
  archivado: 'success',
}

const CorrespondenciaDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canDerivarCorrespondence } = useAuth()
  const [correspondencia, setCorrespondencia] = useState<Correspondencia | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      loadCorrespondencia(parseInt(id))
    }
  }, [id])

  const loadCorrespondencia = async (correspondenciaId: number) => {
    setLoading(true)
    try {
      const response = await correspondenciaAPI.obtener(correspondenciaId)
      setCorrespondencia(response.data)
    } catch (err) {
      setError('Error al cargar la correspondencia')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error || !correspondencia) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Volver
        </Button>
        <Alert severity="error">{error || 'Correspondencia no encontrada'}</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Typography variant="h4" fontWeight="bold">
            Correspondencia #{correspondencia.id}
          </Typography>
          <Chip
            label={correspondencia.estado}
            color={estadoColors[correspondencia.estado]}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canDerivarCorrespondence() && (
            <Button
              variant="outlined"
              startIcon={<DerivacionIcon />}
              onClick={() => {/* Abrir diálogo de derivación */}}
            >
              Derivar
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/correspondencia/${id}/editar`)}
          >
            Editar
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Información principal */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información General
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Número de Documento
                  </Typography>
                  <Typography>{correspondencia.numero_documento || 'Sin número'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Remitente
                  </Typography>
                  <Typography>{correspondencia.remitente}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Fecha del Documento
                  </Typography>
                  <Typography>
                    {correspondencia.fecha_documento
                      ? format(new Date(correspondencia.fecha_documento), 'dd/MM/yyyy', { locale: es })
                      : 'No especificada'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Fecha de Recibo
                  </Typography>
                  <Typography>
                    {format(new Date(correspondencia.fecha_recibo), 'dd/MM/yyyy', { locale: es })}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Departamento
                  </Typography>
                  <Typography>{correspondencia.departamento?.nombre || 'Sin asignar'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Descripción
                  </Typography>
                  <Typography>{correspondencia.descripcion || 'Sin descripción'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Panel lateral */}
        <Grid item xs={12} md={4}>
          {/* Adjuntos */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <AttachIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Adjuntos
              </Typography>
              {correspondencia.adjuntos && correspondencia.adjuntos.length > 0 ? (
                <List dense>
                  {correspondencia.adjuntos.map((adj) => (
                    <ListItem key={adj.id}>
                      <ListItemIcon>
                        <AttachIcon />
                      </ListItemIcon>
                      <ListItemText primary={adj.nombre_archivo} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin adjuntos
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Historial de derivaciones */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Derivaciones
              </Typography>
              {correspondencia.derivaciones && correspondencia.derivaciones.length > 0 ? (
                <List dense>
                  {correspondencia.derivaciones.map((der) => (
                    <ListItem key={der.id}>
                      <ListItemText
                        primary={`${der.departamento_origen?.nombre} → ${der.departamento_destino?.nombre}`}
                        secondary={format(new Date(der.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      />
                      <Chip
                        label={der.estado}
                        size="small"
                        color={der.estado === 'recibido' ? 'success' : 'warning'}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin derivaciones
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default CorrespondenciaDetail
