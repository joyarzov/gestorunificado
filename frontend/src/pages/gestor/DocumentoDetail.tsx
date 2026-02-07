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
  Snackbar,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Send as EnviarIcon,
  Create as FirmarIcon,
  CheckCircle as FirmadoIcon,
  HourglassEmpty as PendienteIcon,
  Cancel as RechazadoIcon,
} from '@mui/icons-material'
import { documentosAPI } from '../../api/gestor'
import { Documento, DocumentoFirma, User } from '../../types'
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

const estadoLabels: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_firma: 'Pendiente de Firma',
  firmado: 'Firmado',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
}

const DocumentoDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [documento, setDocumento] = useState<Documento | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

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
      setSnackbar({ open: true, message: 'Documento enviado a firma', severity: 'success' })
      loadDocumento(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al enviar a firma'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleFirmar = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await documentosAPI.firmar(parseInt(id))
      setSnackbar({ open: true, message: 'Documento firmado exitosamente', severity: 'success' })
      loadDocumento(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al firmar'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRechazar = async () => {
    if (!id) return
    const motivo = prompt('Ingrese el motivo del rechazo:')
    if (!motivo) return
    setActionLoading(true)
    try {
      await documentosAPI.rechazarFirma(parseInt(id), motivo)
      setSnackbar({ open: true, message: 'Firma rechazada', severity: 'success' })
      loadDocumento(parseInt(id))
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al rechazar firma'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  // Determinar si el usuario actual puede firmar:
  // - Documento en estado pendiente_firma
  // - Usuario está en firmantes_asignados O es firmante_asignado_id
  // - Usuario no ha firmado ya (no tiene firma con estado 'firmado')
  const getFirmaDelUsuario = (firmas: DocumentoFirma[], userId: number) => {
    return firmas?.find(f => (f.usuario_id === userId || f.firmante_id === userId) && f.estado === 'firmado')
  }

  const esAsignado = documento?.firmantes_asignados?.some(u => u.id === user?.id) ||
    documento?.firmante_asignado_id === user?.id

  const yaFirmo = user ? !!getFirmaDelUsuario(documento?.firmas || [], user.id) : false

  const puedeEnviarAFirma = documento?.estado === 'borrador' &&
    ((documento?.firmantes_asignados && documento.firmantes_asignados.length > 0) || documento?.firmante_asignado_id)

  const puedeFirmar = documento?.estado === 'pendiente_firma' && esAsignado && !yaFirmo

  // Build the list of firmantes with their status
  const getFirmantesConEstado = () => {
    if (!documento) return []

    const firmantes: Array<{ user: User; estado: 'pendiente' | 'firmado' | 'rechazado'; fecha?: string; observacion?: string }> = []

    const asignados = documento.firmantes_asignados || []
    // If no firmantes_asignados but there's firmante_asignado, use that
    if (asignados.length === 0 && documento.firmante_asignado) {
      const firma = documento.firmas?.find(f => f.usuario_id === documento.firmante_asignado_id || f.firmante_id === documento.firmante_asignado_id)
      firmantes.push({
        user: documento.firmante_asignado,
        estado: firma?.estado || 'pendiente',
        fecha: firma?.fecha_firma,
        observacion: firma?.observacion || firma?.observaciones,
      })
      return firmantes
    }

    for (const asignado of asignados) {
      const firma = documento.firmas?.find(f => f.usuario_id === asignado.id || f.firmante_id === asignado.id)
      firmantes.push({
        user: asignado,
        estado: firma?.estado || 'pendiente',
        fecha: firma?.fecha_firma,
        observacion: firma?.observacion || firma?.observaciones,
      })
    }

    return firmantes
  }

  const firmantesConEstado = documento ? getFirmantesConEstado() : []

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
            {documento.numero || documento.identificador}
          </Typography>
          <Chip
            label={estadoLabels[documento.estado] || documento.estado}
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
            <>
              <Button
                variant="contained"
                color="success"
                startIcon={actionLoading ? <CircularProgress size={20} /> : <FirmarIcon />}
                onClick={handleFirmar}
                disabled={actionLoading}
              >
                Firmar
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={handleRechazar}
                disabled={actionLoading}
              >
                Rechazar
              </Button>
            </>
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
            <Card sx={{ bgcolor: '#e0e0e0' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="h6" gutterBottom>
                  Contenido
                </Typography>
                <Box
                  sx={{
                    maxHeight: '85vh',
                    overflow: 'auto',
                    pb: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 794,
                      mx: 'auto',
                      minHeight: 1123,
                      bgcolor: 'white',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                      p: '96px 72px 96px 96px',
                      '& > div': {
                        maxWidth: '100% !important',
                        padding: '0 !important',
                        margin: '0 !important',
                        lineHeight: '1.6 !important',
                      },
                    }}
                    dangerouslySetInnerHTML={{ __html: documento.contenido_html }}
                  />
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Firmas */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6">
                  Firmas
                </Typography>
                {documento.firmas_requeridas && (
                  <Chip
                    label={`${documento.firmas?.filter(f => f.estado === 'firmado').length || 0} / ${documento.firmas_requeridas} requeridas`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
              {firmantesConEstado.length > 0 ? (
                <List dense>
                  {firmantesConEstado.map((item) => (
                    <ListItem key={item.user.id}>
                      <ListItemIcon>
                        {item.estado === 'firmado' ? (
                          <FirmadoIcon color="success" />
                        ) : item.estado === 'rechazado' ? (
                          <RechazadoIcon color="error" />
                        ) : (
                          <PendienteIcon color="disabled" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.user.nombre}
                        secondary={
                          item.estado === 'firmado' && item.fecha
                            ? `Firmado el ${format(new Date(item.fecha), 'dd/MM/yyyy HH:mm', { locale: es })}`
                            : item.estado === 'rechazado'
                              ? `Rechazado${item.observacion ? ': ' + item.observacion : ''}`
                              : 'Pendiente de firma'
                        }
                      />
                      <Chip
                        label={item.estado === 'firmado' ? 'Firmado' : item.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                        size="small"
                        color={item.estado === 'firmado' ? 'success' : item.estado === 'rechazado' ? 'error' : 'default'}
                        variant="outlined"
                      />
                    </ListItem>
                  ))}
                </List>
              ) : documento.estado === 'borrador' ? (
                <Typography variant="body2" color="text.secondary">
                  {(documento.firmantes_asignados?.length || documento.firmante_asignado_id)
                    ? 'Las firmas se activarán al enviar el documento a firma'
                    : 'No hay firmantes asignados'}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No hay firmantes asignados
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

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default DocumentoDetail
