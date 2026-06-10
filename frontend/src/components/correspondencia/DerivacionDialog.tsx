import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  CircularProgress,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
} from '@mui/material'
import {
  CheckCircle as SuccessIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material'
import { departamentosAPI, usersAPI } from '../../api/common'
import { correspondenciaAPI, CreateDerivacionData } from '../../api/correspondencia'
import { Departamento, User } from '../../types'
import FirmaGobModal, { FirmaParams } from './FirmaGobModal'

const ACCIONES_PARA_OPTIONS = [
  'Tomar conocimiento',
  'Informar',
  'Tramitar',
  'Archivar',
  'Responder',
  'Coordinar',
  'Cumplir',
]

interface DerivacionDialogProps {
  open: boolean
  onClose: () => void
  correspondenciaId: number
  prefillDepartamentoId?: number
  prefillUsuarioId?: number
  readOnly?: boolean
  mode?: 'alcalde' | 'funcionario'
  onSuccess: () => void
}

const DerivacionDialog = ({
  open,
  onClose,
  correspondenciaId,
  prefillDepartamentoId,
  prefillUsuarioId,
  readOnly = false,
  mode = 'alcalde',
  onSuccess,
}: DerivacionDialogProps) => {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [selectedDepto, setSelectedDepto] = useState<Departamento | null>(null)
  const [selectedUsuario, setSelectedUsuario] = useState<User | null>(null)
  // Modo alcalde: destino flexible (funcionarios específicos / depto completo / todos)
  const [tipoDestino, setTipoDestino] = useState<'funcionarios' | 'departamento' | 'todos'>('funcionarios')
  const [selectedUsuarios, setSelectedUsuarios] = useState<User[]>([])
  const [observaciones, setObservaciones] = useState('')
  const [accionesPara, setAccionesPara] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [showSuccess, setShowSuccess] = useState(false)
  const [providenciaCorrespondenciaId, setProvidenciaCorrespondenciaId] = useState<number | null>(null)

  // FirmaGob modal
  const [showFirmaModal, setShowFirmaModal] = useState(false)
  const [firmaLoading, setFirmaLoading] = useState(false)
  const [firmaError, setFirmaError] = useState<string | null>(null)
  const [pendingData, setPendingData] = useState<CreateDerivacionData | null>(null)
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const esModoFuncionario = mode === 'funcionario'

  useEffect(() => {
    if (open) {
      loadData()
      setShowSuccess(false)
      setProvidenciaCorrespondenciaId(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const loadData = async () => {
    setLoadingData(true)
    try {
      const [deptosRes, usersRes] = await Promise.all([
        departamentosAPI.listar(),
        usersAPI.funcionarios(),
      ])
      setDepartamentos(deptosRes.data)
      setUsuarios(usersRes.data)

      if (prefillDepartamentoId) {
        const depto = deptosRes.data.find((d: Departamento) => d.id === prefillDepartamentoId)
        if (depto) setSelectedDepto(depto)
      }
      if (prefillUsuarioId) {
        const user = usersRes.data.find((u: User) => u.id === prefillUsuarioId)
        if (user) setSelectedUsuario(user)
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoadingData(false)
    }
  }

  const handleToggleAccion = (accion: string) => {
    setAccionesPara((prev) =>
      prev.includes(accion)
        ? prev.filter((a) => a !== accion)
        : [...prev, accion]
    )
  }

  // Destino según modalidad. En modo alcalde el departamento ya no es
  // obligatorio: se puede derivar a funcionario(s), a un depto completo o a todos.
  const buildDestino = () => {
    if (!esModoFuncionario || readOnly) {
      return {
        departamento_destino_id: selectedDepto?.id,
        usuario_destino_id: selectedUsuario?.id,
      }
    }
    if (tipoDestino === 'todos') return { derivar_a_todos: true }
    if (tipoDestino === 'departamento') return { departamento_destino_id: selectedDepto?.id }
    return { usuario_destino_ids: selectedUsuarios.map((u) => u.id) }
  }

  const destinoValido = esModoFuncionario && !readOnly
    ? (tipoDestino === 'todos'
        || (tipoDestino === 'departamento' ? !!selectedDepto : selectedUsuarios.length > 0))
    : !!selectedDepto

  const handleSubmit = async () => {
    if (!destinoValido) return

    const formData: CreateDerivacionData = {
      correspondencia_id: correspondenciaId,
      ...buildDestino(),
      observaciones: observaciones || undefined,
      acciones_para: esModoFuncionario && accionesPara.length > 0 ? accionesPara : undefined,
    }

    if (esModoFuncionario) {
      // Alcalde derivando → primero generar preview de la providencia y luego pedir OTP
      setPendingData(formData)
      setFirmaError(null)
      setPreviewLoading(true)
      try {
        const { blob, token } = await correspondenciaAPI.previewDerivar({
          correspondencia_id: correspondenciaId,
          ...buildDestino(),
          observaciones: observaciones || undefined,
          acciones_para: accionesPara.length > 0 ? accionesPara : undefined,
        })
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        setPreviewPdfUrl(url)
        setPreviewToken(token)
        setShowFirmaModal(true)
      } catch (err: any) {
        setFirmaError(err?.response?.data?.message || 'No se pudo generar la vista previa de la providencia.')
        setShowFirmaModal(true)
      } finally {
        setPreviewLoading(false)
      }
      return
    }

    // Modo no-alcalde: derivar directamente
    setLoading(true)
    try {
      await correspondenciaAPI.derivar(formData)
      onSuccess()
      handleClose()
    } catch (err) {
      console.error('Error al derivar:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFirmarYDerivar = async ({ otp, firmaY, firmaPage, firmaCol }: FirmaParams) => {
    if (!pendingData) return
    setFirmaLoading(true)
    setFirmaError(null)
    try {
      await correspondenciaAPI.derivar({
        ...pendingData,
        otp,
        firma_y: firmaY,
        firma_page: firmaPage,
        firma_col: firmaCol,
        preview_token: previewToken ?? undefined,
      })
      setShowFirmaModal(false)
      revokePreview()
      setProvidenciaCorrespondenciaId(correspondenciaId)
      setShowSuccess(true)
    } catch (err: any) {
      setFirmaError(err?.response?.data?.message || 'Error al firmar. Verifique el código OTP e intente nuevamente.')
    } finally {
      setFirmaLoading(false)
    }
  }

  const revokePreview = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl)
    }
    setPreviewPdfUrl(null)
    setPreviewToken(null)
  }

  const handleClose = () => {
    revokePreview()
    setSelectedDepto(null)
    setSelectedUsuario(null)
    setSelectedUsuarios([])
    setTipoDestino('funcionarios')
    setObservaciones('')
    setAccionesPara([])
    setShowSuccess(false)
    setProvidenciaCorrespondenciaId(null)
    setShowFirmaModal(false)
    setPendingData(null)
    setFirmaError(null)
    onClose()
  }

  const handleSuccessClose = () => {
    onSuccess()
    handleClose()
  }

  const handleVerProvidencia = async () => {
    if (!providenciaCorrespondenciaId) return
    try {
      const blob = await correspondenciaAPI.descargarProvidencia(providenciaCorrespondenciaId)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch (err) {
      console.error('Error al descargar providencia:', err)
    }
  }

  const filteredUsuarios = selectedDepto
    ? usuarios.filter((u) => u.departamento_id === selectedDepto.id)
    : usuarios

  // Modal FirmaGob (mientras el formulario principal permanece abierto detrás)
  if (showFirmaModal) {
    return (
      <>
        {/* Mantener el Dialog del formulario montado pero tapado por FirmaGobModal */}
        <FirmaGobModal
          open={showFirmaModal}
          titulo="Firmar Providencia con FirmaGob"
          descripcion="La providencia será firmada electrónicamente antes de derivar la correspondencia. Seleccione la posición del sello e ingrese su código OTP."
          loading={firmaLoading || previewLoading}
          error={firmaError}
          pdfUrl={previewPdfUrl}
          onFirmar={handleFirmarYDerivar}
          onCancel={() => {
            setShowFirmaModal(false)
            setFirmaError(null)
            revokePreview()
          }}
        />
      </>
    )
  }

  // Success view after providencia generation
  if (showSuccess) {
    return (
      <Dialog open={open} onClose={handleSuccessClose} maxWidth="sm" fullWidth>
        <DialogTitle>Derivacion Completada</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <SuccessIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Providencia generada exitosamente
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              La correspondencia ha sido derivada y se ha generado la providencia PDF.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<PdfIcon />}
              onClick={handleVerProvidencia}
              sx={{ mb: 1 }}
            >
              Ver Providencia PDF
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleSuccessClose}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {readOnly ? 'Derivar a Alcalde' : 'Derivar a Funcionario'}
      </DialogTitle>
      <DialogContent>
        {loadingData ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {esModoFuncionario && !readOnly ? (
              <>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  color="primary"
                  value={tipoDestino}
                  onChange={(_, value) => {
                    if (!value) return
                    setTipoDestino(value)
                    setSelectedDepto(null)
                    setSelectedUsuarios([])
                  }}
                >
                  <ToggleButton value="funcionarios">Funcionario(s)</ToggleButton>
                  <ToggleButton value="departamento">Departamento</ToggleButton>
                  <ToggleButton value="todos">Todos</ToggleButton>
                </ToggleButtonGroup>

                {tipoDestino === 'funcionarios' && (
                  <>
                    <Autocomplete
                      options={departamentos}
                      getOptionLabel={(opt) => opt.nombre}
                      value={selectedDepto}
                      onChange={(_, value) => setSelectedDepto(value)}
                      renderInput={(params) => (
                        <TextField {...params} label="Filtrar por departamento (opcional)" />
                      )}
                    />
                    <Autocomplete
                      multiple
                      options={filteredUsuarios}
                      getOptionLabel={(opt) => `${opt.nombre} (${opt.rut})`}
                      value={selectedUsuarios}
                      onChange={(_, value) => setSelectedUsuarios(value)}
                      renderTags={(value, getTagProps) =>
                        value.map((opt, index) => (
                          <Chip
                            {...getTagProps({ index })}
                            key={opt.id}
                            label={opt.nombre}
                            size="small"
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField {...params} label="Funcionario(s) destino" required={selectedUsuarios.length === 0} />
                      )}
                    />
                  </>
                )}

                {tipoDestino === 'departamento' && (
                  <Autocomplete
                    options={departamentos}
                    getOptionLabel={(opt) => opt.nombre}
                    value={selectedDepto}
                    onChange={(_, value) => setSelectedDepto(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Departamento destino"
                        required
                        helperText="La correspondencia llegará a la bandeja de todos los funcionarios del departamento"
                      />
                    )}
                  />
                )}

                {tipoDestino === 'todos' && (
                  <Alert severity="warning">
                    Se derivará a <strong>todos los funcionarios activos</strong> del municipio
                    ({usuarios.length}). Cada uno la recibirá en su bandeja de entrada.
                  </Alert>
                )}
              </>
            ) : (
              <>
                <Autocomplete
                  options={departamentos}
                  getOptionLabel={(opt) => opt.nombre}
                  value={selectedDepto}
                  onChange={(_, value) => {
                    setSelectedDepto(value)
                    setSelectedUsuario(null)
                  }}
                  readOnly={readOnly}
                  renderInput={(params) => (
                    <TextField {...params} label="Departamento destino" required />
                  )}
                />
                <Autocomplete
                  options={filteredUsuarios}
                  getOptionLabel={(opt) => `${opt.nombre} (${opt.rut})`}
                  value={selectedUsuario}
                  onChange={(_, value) => setSelectedUsuario(value)}
                  readOnly={readOnly}
                  renderInput={(params) => (
                    <TextField {...params} label="Usuario destino (opcional)" />
                  )}
                />
              </>
            )}

            {esModoFuncionario && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  PARA:
                </Typography>
                <Alert severity="info" sx={{ mb: 1 }}>
                  Seleccione las acciones requeridas para esta derivacion
                </Alert>
                <FormGroup>
                  {ACCIONES_PARA_OPTIONS.map((accion) => (
                    <FormControlLabel
                      key={accion}
                      control={
                        <Checkbox
                          checked={accionesPara.includes(accion)}
                          onChange={() => handleToggleAccion(accion)}
                          size="small"
                        />
                      }
                      label={accion}
                    />
                  ))}
                </FormGroup>
              </Box>
            )}

            <TextField
              label="Observaciones"
              multiline
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading || previewLoading}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || previewLoading || !destinoValido}
        >
          {loading || previewLoading ? <CircularProgress size={20} /> : 'Derivar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DerivacionDialog
