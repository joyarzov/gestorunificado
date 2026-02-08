import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  CheckCircle as CheckIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { documentoEnviosAPI } from '../../api/gestor'
import { DocumentoEnvio } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const DocumentosRecibidos = () => {
  const navigate = useNavigate()
  const [envios, setEnvios] = useState<DocumentoEnvio[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  useEffect(() => {
    loadRecibidos()
  }, [filtroEstado])

  const loadRecibidos = async () => {
    setLoading(true)
    try {
      const params: { estado?: string } = {}
      if (filtroEstado !== 'todos') {
        params.estado = filtroEstado
      }
      const response = await documentoEnviosAPI.recibidos(params)
      setEnvios(response.data.data)
    } catch (err) {
      console.error('Error cargando documentos recibidos:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAcusarRecibo = async (envioId: number) => {
    setActionLoading(envioId)
    try {
      await documentoEnviosAPI.acusarRecibo(envioId)
      setSnackbar({ open: true, message: 'Acuse de recibo registrado', severity: 'success' })
      loadRecibidos()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al acusar recibo'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Typography variant="h4" fontWeight="bold">
            Documentos Recibidos
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={filtroEstado}
          exclusive
          onChange={(_, val) => { if (val) setFiltroEstado(val) }}
          size="small"
        >
          <ToggleButton value="todos">Todos</ToggleButton>
          <ToggleButton value="enviado">Pendientes</ToggleButton>
          <ToggleButton value="completado">Completados</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Documento</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Remitente</TableCell>
                <TableCell>Fecha Envío</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : envios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay documentos recibidos
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                envios.map((envio) => (
                  <TableRow
                    key={envio.id}
                    hover
                    sx={envio.estado === 'enviado' ? { bgcolor: 'action.hover' } : undefined}
                  >
                    <TableCell>
                      <Typography
                        sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: envio.estado === 'enviado' ? 'bold' : 'normal' }}
                        onClick={() => navigate(`/documentos/${envio.documento_id}`)}
                      >
                        {envio.documento?.numero || envio.documento?.identificador || `Doc #${envio.documento_id}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {envio.documento?.titulo}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {envio.documento?.tipo_documental?.nombre || '-'}
                    </TableCell>
                    <TableCell>
                      {envio.remitente?.nombre || '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(envio.fecha_envio), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={envio.estado === 'enviado' ? 'Pendiente' : 'Completado'}
                        color={envio.estado === 'enviado' ? 'warning' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Button
                          size="small"
                          startIcon={<ViewIcon />}
                          onClick={() => navigate(`/documentos/${envio.documento_id}`)}
                        >
                          Ver
                        </Button>
                        {envio.estado === 'enviado' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={actionLoading === envio.id ? <CircularProgress size={16} /> : <CheckIcon />}
                            onClick={() => handleAcusarRecibo(envio.id)}
                            disabled={actionLoading === envio.id}
                          >
                            Acusar Recibo
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

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

export default DocumentosRecibidos
