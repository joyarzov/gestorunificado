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
  Button,
  CircularProgress,
  Alert,
} from '@mui/material'
import { documentosAPI } from '../../api/gestor'
import { Documento } from '../../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const PendientesFirma = () => {
  const navigate = useNavigate()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPendientes()
  }, [])

  const loadPendientes = async () => {
    setLoading(true)
    try {
      const response = await documentosAPI.pendientesFirma()
      setDocumentos(response.data.data)
    } catch (err) {
      setError('Error al cargar documentos pendientes')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Documentos Pendientes de Firma
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Número</TableCell>
                <TableCell>Título</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Creado por</TableCell>
                <TableCell>Fecha</TableCell>
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
              ) : documentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No tienes documentos pendientes de firma
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                documentos.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.numero || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 250,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.titulo}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.tipo_documental?.nombre || '-'}</TableCell>
                    <TableCell>{item.creador?.nombre || '-'}</TableCell>
                    <TableCell>
                      {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => navigate(`/documentos/${item.id}`)}
                      >
                        Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  )
}

export default PendientesFirma
