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
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Send as EnviarIcon,
  Create as FirmarIcon,
  Person as PersonIcon,
} from '@mui/icons-material'
import { documentosAPI } from '../../api/gestor'
import { Documento } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'

const estadoColors: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  borrador: 'default',
  pendiente_firma: 'warning',
  firmado: 'success',
  rechazado: 'error',
  anulado: 'error',
}

const DocumentoDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [documento, setDocumento] = useState<Documento | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadDocumento(parseInt(id))
    }
  }, [id])

  const loadDocumento = async (docId: number) => {
    setLoading(true)
    try {
      const response = await documentosAPI.obtener(docId)
      setDocumento(response.data)
    } catch (err) {
      setError('Error al cargar el documento')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleEnviarAFirma = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await documentosAPI.enviarAFirma(parseInt(id))
      loadDocumento(parseInt(id))
    } catch (err) {
      console.error('Error al enviar a firma:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleFirmar = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await documentosAPI.firmar(parseInt(id))
      loadDocumento(parseInt(id))
    } catch (err) {
      console.error('Error al firmar:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const puedeEnviarAFirma = documento?.estado === 'borrador'
  const puedeFirmar = documento?.estado === 'pendiente_firma' &&
    documento?.firmas?.some(f => f.usuario_id === user?.id && f.estado === 'pendiente')

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error || !documento) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
          Volver
        </Button>
        <Alert severity="error">{error || 'Documento no encontrado'}</Alert>
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
            {documento.numero || 'Documento'}
          </Typography>
          <Chip
            label={documento.estado.replace('_', ' ')}
            color={estadoColors[documento.estado]}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {puedeEnviarAFirma && (
            <Button
              variant="outlined"
              startIcon={actionLoading ? <CircularProgress size={20} /> : <EnviarIcon />}
              onClick={handleEnviarAFirma}
              disabled={actionLoading}
            >
              Enviar a Firma
            </Button>
          )}
          {puedeFirmar && (
            <Button
              variant="contained"
              color="success"
              startIcon={actionLoading ? <CircularProgress size={20} /> : <FirmarIcon />}
              onClick={handleFirmar}
              disabled={actionLoading}
            >
              Firmar
            </Button>
          )}
          {documento.estado === 'borrador' && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/documentos/${id}/editar`)}
            >
              Editar
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información del Documento
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Título
                  </Typography>
                  <Typography fontWeight="medium">{documento.titulo}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Tipo Documental
                  </Typography>
                  <Typography>{documento.tipo_documental?.nombre}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Número
                  </Typography>
                  <Typography>{documento.numero || 'Pendiente'}</Typography>
                </Grid>
                {documento.expedientes && documento.expedientes.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Expedientes
                    </Typography>
                    {documento.expedientes.map((exp) => (
                      <Typography
                        key={exp.id}
                        sx={{ cursor: 'pointer', color: 'primary.main' }}
                        onClick={() => navigate(`/expedientes/${exp.id}`)}
                      >
                        {exp.numero_expediente || exp.identificador} - {exp.titulo}
                      </Typography>
                    ))}
                  </Grid>
                )}
                {documento.descripcion && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">
                      Descripción
                    </Typography>
                    <Typography>{documento.descripcion}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Vista previa del contenido */}
          {documento.contenido_html && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Contenido
                </Typography>
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 2,
                    bgcolor: 'white',
                    minHeight: 400,
                  }}
                  dangerouslySetInnerHTML={{ __html: documento.contenido_html }}
                />
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Firmas */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Firmas
              </Typography>
              {documento.firmas && documento.firmas.length > 0 ? (
                <List dense>
                  {documento.firmas.map((firma) => (
                    <ListItem key={firma.id}>
                      <ListItemIcon>
                        <PersonIcon
                          color={firma.estado === 'firmado' ? 'success' : 'disabled'}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={firma.usuario?.nombre}
                        secondary={firma.estado}
                      />
                      {firma.estado === 'firmado' && firma.fecha_firma && (
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(firma.fecha_firma), 'dd/MM/yyyy', { locale: es })}
                        </Typography>
                      )}
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin firmas asignadas
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Metadatos */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información Adicional
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Creado por
                </Typography>
                <Typography variant="body2">{documento.creador?.nombre}</Typography>
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Año
                </Typography>
                <Typography variant="body2">{documento.anio}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Fecha de creación
                </Typography>
                <Typography variant="body2">
                  {format(new Date(documento.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default DocumentoDetail
