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
  Alert,
  Chip,
} from '@mui/material'
import { PersonAdd as PersonAddIcon } from '@mui/icons-material'
import { departamentosAPI, usersAPI } from '../../api/common'
import { correspondenciaAPI } from '../../api/correspondencia'
import { Departamento, Derivacion, User } from '../../types'

interface IncorporarDialogProps {
  open: boolean
  onClose: () => void
  correspondenciaId: number
  /** Derivaciones vigentes: para avisar a quién ya la tiene y no ofrecerlo de nuevo. */
  derivacionesActuales?: Derivacion[]
  onSuccess: () => void
}

/**
 * "Incorporar funcionario" a una correspondencia ya en circulación. A diferencia
 * de derivar: suma a la bandeja SIN quitársela a quien la gestiona, no genera
 * providencia ni exige firma. Lo usan jefaturas y usuarios designados por el admin.
 */
const IncorporarDialog = ({
  open,
  onClose,
  correspondenciaId,
  derivacionesActuales = [],
  onSuccess,
}: IncorporarDialogProps) => {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [selectedUsuarios, setSelectedUsuarios] = useState<User[]>([])
  const [selectedDeptos, setSelectedDeptos] = useState<Departamento[]>([])
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      loadData()
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
    } catch (err) {
      console.error('Error cargando datos:', err)
      setError('No se pudieron cargar los funcionarios y departamentos.')
    } finally {
      setLoadingData(false)
    }
  }

  // El admin es una cuenta técnica: no debe aparecer como destinatario.
  const usuariosSeleccionables = usuarios.filter(
    (u) => !(u.roles || []).includes('admin')
  )

  // Quién ya tiene la correspondencia hoy (derivaciones vigentes): se avisa para
  // que el director no la vuelva a elegir (el backend igual la descarta).
  const yaLaTienen = derivacionesActuales
    .filter((d) => d.estado === 'pendiente' || d.estado === 'recibido')
    .map((d) => d.usuario_destino?.nombre || d.departamento_destino?.nombre)
    .filter((n): n is string => !!n)
    .filter((n, i, arr) => arr.indexOf(n) === i)

  const destinoValido = selectedUsuarios.length > 0 || selectedDeptos.length > 0

  const handleClose = () => {
    setSelectedUsuarios([])
    setSelectedDeptos([])
    setObservaciones('')
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!destinoValido) return
    setLoading(true)
    setError(null)
    try {
      await correspondenciaAPI.incorporarFuncionarios(correspondenciaId, {
        usuario_destino_ids: selectedUsuarios.length > 0 ? selectedUsuarios.map((u) => u.id) : undefined,
        departamento_destino_ids: selectedDeptos.length > 0 ? selectedDeptos.map((d) => d.id) : undefined,
        observaciones: observaciones || undefined,
      })
      onSuccess()
      handleClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo incorporar al funcionario.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonAddIcon color="primary" /> Incorporar funcionario
      </DialogTitle>
      <DialogContent>
        {loadingData ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="info">
              El funcionario recibirá esta correspondencia en su bandeja y deberá acusar recibo.
              <strong> No se la quita a quien la tiene hoy</strong>: solo se suma.
            </Alert>

            {yaLaTienen.length > 0 && (
              <Alert severity="info">
                Ya la tienen <strong>{yaLaTienen.join(', ')}</strong>. Elige solo a quien falte.
              </Alert>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            <Autocomplete
              multiple
              options={usuariosSeleccionables}
              getOptionLabel={(opt) => `${opt.nombre} (${opt.rut})`}
              value={selectedUsuarios}
              onChange={(_, value) => setSelectedUsuarios(value)}
              isOptionEqualToValue={(opt, value) => opt.id === value.id}
              renderOption={(props, opt) => (
                <Box component="li" {...props} key={opt.id}>
                  <Box>
                    <Typography variant="body2">{opt.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[opt.cargo, departamentos.find((d) => d.id === opt.departamento_id)?.nombre]
                        .filter(Boolean)
                        .join(' · ') || opt.rut}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderTags={(value, getTagProps) =>
                value.map((opt, index) => (
                  <Chip {...getTagProps({ index })} key={opt.id} label={opt.nombre} size="small" />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Funcionario(s) a incorporar"
                  helperText="Busca por nombre; puedes elegir a varios"
                />
              )}
            />

            <Autocomplete
              multiple
              options={departamentos}
              getOptionLabel={(opt) => opt.nombre}
              value={selectedDeptos}
              onChange={(_, value) => setSelectedDeptos(value)}
              isOptionEqualToValue={(opt, value) => opt.id === value.id}
              renderTags={(value, getTagProps) =>
                value.map((opt, index) => (
                  <Chip {...getTagProps({ index })} key={opt.id} label={opt.nombre} size="small" />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Departamento(s) completo(s) — opcional"
                  helperText="Llega a la bandeja de todos los funcionarios del departamento"
                />
              )}
            />

            {!destinoValido && (
              <Typography variant="caption" color="text.secondary">
                Elige al menos un funcionario o un departamento.
              </Typography>
            )}

            <TextField
              label="Observaciones (opcional)"
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
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !destinoValido}>
          {loading ? <CircularProgress size={20} /> : 'Incorporar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default IncorporarDialog
