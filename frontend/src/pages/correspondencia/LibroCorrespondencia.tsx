import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Pagination,
  MenuItem,
} from '@mui/material'
import {
  MenuBook as LibroIcon,
  Download as DownloadIcon,
  Verified as FirmadoIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { correspondenciaAPI, LibroCorrespondencia as Libro } from '../../api/correspondencia'
import FirmaGobModal, { FirmaParams } from '../../components/correspondencia/FirmaGobModal'

const hoy = () => new Date().toISOString().slice(0, 10)
const inicioMes = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const LibroCorrespondencia = () => {
  const [fechaDesde, setFechaDesde] = useState(inicioMes())
  const [fechaHasta, setFechaHasta] = useState(hoy())
  const [tipoLibro, setTipoLibro] = useState<'entradas' | 'salidas'>('entradas')

  const [libros, setLibros] = useState<Libro[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loadingLibros, setLoadingLibros] = useState(true)

  // Flujo preview → firma (mismo patrón que las providencias)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [showFirmaModal, setShowFirmaModal] = useState(false)
  const [firmaLoading, setFirmaLoading] = useState(false)
  const [firmaError, setFirmaError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  const cargarLibros = useCallback(async () => {
    setLoadingLibros(true)
    try {
      const res = await correspondenciaAPI.librosListar(page)
      setLibros(res.data.data)
      setLastPage(res.data.last_page)
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar el historial de libros' })
    } finally {
      setLoadingLibros(false)
    }
  }, [page])

  useEffect(() => { cargarLibros() }, [cargarLibros])

  const revokePreview = () => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl)
    setPreviewPdfUrl(null)
    setPreviewToken(null)
  }

  const handleGenerar = async () => {
    setMensaje(null)
    setFirmaError(null)
    setPreviewLoading(true)
    try {
      const { blob, token } = await correspondenciaAPI.libroPreview(fechaDesde, fechaHasta, tipoLibro)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      setPreviewPdfUrl(url)
      setPreviewToken(token)
      setShowFirmaModal(true)
    } catch (err: any) {
      // El error viene como blob al pedir responseType blob
      let texto = 'No se pudo generar la vista previa del libro.'
      try {
        const parsed = JSON.parse(await (err?.response?.data as Blob)?.text())
        texto = parsed?.message || texto
      } catch { /* respuesta no-JSON */ }
      setMensaje({ tipo: 'error', texto })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleFirmar = async ({ otp, firmaY, firmaPage, firmaCol, desatendida }: FirmaParams) => {
    if (!previewToken) return
    setFirmaLoading(true)
    setFirmaError(null)
    try {
      const res = await correspondenciaAPI.libroFirmar(previewToken, otp, firmaY, firmaPage, firmaCol, desatendida)
      setShowFirmaModal(false)
      revokePreview()
      setMensaje({ tipo: 'success', texto: res.message || `Libro ${res.data.folio} generado y firmado` })
      setPage(1)
      cargarLibros()
    } catch (err: any) {
      setFirmaError(err?.response?.data?.message || 'Error al firmar. Verifique el código OTP e intente nuevamente.')
    } finally {
      setFirmaLoading(false)
    }
  }

  const handleDescargar = async (libro: Libro) => {
    try {
      const blob = await correspondenciaAPI.libroDescargar(libro.id)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${libro.folio}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo descargar el libro' })
    }
  }

  const nombreGenerador = (l: Libro) => {
    const g = l.generado_por
    return typeof g === 'object' && g ? g.nombre : '—'
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
        Libro de Correspondencia
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Documento oficial del período, firmado electrónicamente por la Oficina de Partes. Cada libro
        emitido queda registrado y es verificable por su código QR.
      </Typography>

      {mensaje && (
        <Alert severity={mensaje.tipo} sx={{ mb: 2 }} onClose={() => setMensaje(null)}>
          {mensaje.texto}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            <LibroIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Generar nuevo libro
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              select
              label="Tipo de libro"
              size="small"
              value={tipoLibro}
              onChange={(e) => setTipoLibro(e.target.value as 'entradas' | 'salidas')}
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="entradas">Entradas</MenuItem>
              <MenuItem value="salidas">Salidas</MenuItem>
            </TextField>
            <TextField
              label="Desde"
              type="date"
              size="small"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Hasta"
              type="date"
              size="small"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="contained"
              onClick={handleGenerar}
              disabled={previewLoading || !fechaDesde || !fechaHasta || fechaHasta < fechaDesde}
              startIcon={previewLoading ? <CircularProgress size={18} color="inherit" /> : <FirmadoIcon />}
            >
              {previewLoading ? 'Generando…' : 'Generar y firmar'}
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Se mostrará la vista previa del PDF con identidad corporativa; luego se firma con tu clave OTP
            (firma electrónica avanzada), igual que las providencias.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ pb: 0 }}>
          <Typography variant="h6">Libros emitidos</Typography>
        </CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Folio</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Registros</TableCell>
                <TableCell>Emitido</TableCell>
                <TableCell>Por</TableCell>
                <TableCell>Firma</TableCell>
                <TableCell align="center">Descargar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingLibros ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : libros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">Aún no se han emitido libros</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                libros.map((l) => (
                  <TableRow key={l.id} hover>
                    <TableCell><strong>{l.folio}</strong></TableCell>
                    <TableCell>{l.tipo === 'salidas' ? 'Salidas' : 'Entradas'}</TableCell>
                    <TableCell>
                      {format(new Date(l.fecha_desde), 'dd/MM/yyyy', { locale: es })}
                      {' — '}
                      {format(new Date(l.fecha_hasta), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>{l.total_registros}</TableCell>
                    <TableCell>{format(new Date(l.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</TableCell>
                    <TableCell>{nombreGenerador(l)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={l.firmado ? 'Firmado (FEA)' : 'Sin firma'}
                        color={l.firmado ? 'success' : 'default'}
                        icon={l.firmado ? <FirmadoIcon /> : undefined}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={`Descargar ${l.folio}.pdf`}>
                        <IconButton size="small" onClick={() => handleDescargar(l)}>
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {lastPage > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
            <Pagination count={lastPage} page={page} onChange={(_, v) => setPage(v)} size="small" color="primary" />
          </Box>
        )}
      </Card>

      {showFirmaModal && (
        <FirmaGobModal
          open={showFirmaModal}
          titulo="Firmar Libro de Correspondencia"
          descripcion="Revisa la vista previa del libro del período seleccionado. Elige la posición del sello e ingresa tu código OTP para firmarlo con firma electrónica avanzada."
          loading={firmaLoading}
          error={firmaError}
          pdfUrl={previewPdfUrl}
          onFirmar={handleFirmar}
          onCancel={() => {
            setShowFirmaModal(false)
            setFirmaError(null)
            revokePreview()
          }}
        />
      )}
    </Box>
  )
}

export default LibroCorrespondencia
