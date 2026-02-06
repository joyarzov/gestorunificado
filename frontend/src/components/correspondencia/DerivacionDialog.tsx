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
} from '@mui/material'
import {
  CheckCircle as SuccessIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material'
import { departamentosAPI, usersAPI } from '../../api/common'
import { correspondenciaAPI } from '../../api/correspondencia'
import { Departamento, User } from '../../types'

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
  const [observaciones, setObservaciones] = useState('')
  const [accionesPara, setAccionesPara] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [showSuccess, setShowSuccess] = useState(false)
  const [providenciaCorrespondenciaId, setProvidenciaCorrespondenciaId] = useState<number | null>(null)

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

  const handleSubmit = async () => {
    if (!selectedDepto) return
    setLoading(true)
    try {
      await correspondenciaAPI.derivar({
        correspondencia_id: correspondenciaId,
        departamento_destino_id: selectedDepto.id,
        usuario_destino_id: selectedUsuario?.id,
        observaciones: observaciones || undefined,
        acciones_para: esModoFuncionario && accionesPara.length > 0 ? accionesPara : undefined,
      })
      if (esModoFuncionario) {
        setProvidenciaCorrespondenciaId(correspondenciaId)
        setShowSuccess(true)
      } else {
        onSuccess()
        handleClose()
      }
    } catch (err) {
      console.error('Error al derivar:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedDepto(null)
    setSelectedUsuario(null)
    setObservaciones('')
    setAccionesPara([])
    setShowSuccess(false)
    setProvidenciaCorrespondenciaId(null)
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
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !selectedDepto}
        >
          {loading ? <CircularProgress size={20} /> : 'Derivar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DerivacionDialog
