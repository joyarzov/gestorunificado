import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  CircularProgress,
  Alert,
  Switch,
  Tooltip,
  FormControlLabel,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material'
import { tiposDocumentalesAPI } from '../../api/gestor'
import { TipoDocumental } from '../../types'

/** El backend devuelve el conteo para decidir si el tipo se puede deshabilitar. */
type TipoConUso = TipoDocumental & { documentos_count?: number }

const TiposDocumentalesManage = () => {
  const navigate = useNavigate()
  const [tipos, setTipos] = useState<TipoConUso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<TipoConUso | null>(null)
  const [saving, setSaving] = useState(false)
  const [cambiandoId, setCambiandoId] = useState<number | null>(null)

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    requiere_firma: false,
  })

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await tiposDocumentalesAPI.listar()
      setTipos(res.data || [])
      setError('')
    } catch {
      setError('Error al cargar los tipos documentales')
    } finally {
      setLoading(false)
    }
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ codigo: '', nombre: '', descripcion: '', requiere_firma: false })
    setDialogOpen(true)
  }

  const abrirEdicion = (tipo: TipoConUso) => {
    setEditando(tipo)
    setForm({
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion || '',
      requiere_firma: tipo.requiere_firma,
    })
    setDialogOpen(true)
  }

  const guardar = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) return
    setSaving(true)
    setError('')
    try {
      const datos = {
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        requiere_firma: form.requiere_firma,
      }
      if (editando) {
        await tiposDocumentalesAPI.actualizar(editando.id, datos)
        setAviso(`Tipo "${datos.nombre}" actualizado`)
      } else {
        await tiposDocumentalesAPI.crear({ ...datos, activo: true })
        setAviso(`Tipo "${datos.nombre}" creado y habilitado`)
      }
      setDialogOpen(false)
      cargar()
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'Error al guardar el tipo documental')
    } finally {
      setSaving(false)
    }
  }

  const cambiarEstado = async (tipo: TipoConUso) => {
    setCambiandoId(tipo.id)
    setError('')
    setAviso('')
    try {
      await tiposDocumentalesAPI.actualizar(tipo.id, { activo: !tipo.activo })
      setAviso(tipo.activo
        ? `"${tipo.nombre}" quedó deshabilitado: ya no aparecerá al crear ni subir documentos.`
        : `"${tipo.nombre}" quedó habilitado.`)
      cargar()
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'No se pudo cambiar el estado del tipo documental')
    } finally {
      setCambiandoId(null)
    }
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/administracion')}>Volver</Button>
        <Typography variant="h4" fontWeight="bold" sx={{ flex: 1 }}>Tipos de documento</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={abrirNuevo}>
          Nuevo tipo
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Clasifican los documentos del módulo Cero Papel. Solo los habilitados aparecen al
        crear o subir un documento; un tipo con documentos asociados no se puede deshabilitar,
        porque esos documentos quedarían clasificados con un tipo que ya no existe.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {aviso && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso('')}>{aviso}</Alert>}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Código</strong></TableCell>
                <TableCell><strong>Nombre</strong></TableCell>
                <TableCell><strong>Descripción</strong></TableCell>
                <TableCell align="center"><strong>Requiere firma</strong></TableCell>
                <TableCell align="center"><strong>Documentos</strong></TableCell>
                <TableCell align="center"><strong>Habilitado</strong></TableCell>
                <TableCell align="right"><strong>Acciones</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tipos.map((tipo) => {
                const enUso = tipo.documentos_count ?? 0
                const bloqueado = tipo.activo && enUso > 0
                return (
                  <TableRow key={tipo.id} hover sx={{ opacity: tipo.activo ? 1 : 0.6 }}>
                    <TableCell><Chip label={tipo.codigo} size="small" variant="outlined" /></TableCell>
                    <TableCell>{tipo.nombre}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 13, maxWidth: 320 }}>
                      {tipo.descripcion || '—'}
                    </TableCell>
                    <TableCell align="center">{tipo.requiere_firma ? 'Sí' : 'No'}</TableCell>
                    <TableCell align="center">{enUso}</TableCell>
                    <TableCell align="center">
                      <Tooltip
                        title={bloqueado
                          ? `No se puede deshabilitar: tiene ${enUso} ${enUso === 1 ? 'documento asociado' : 'documentos asociados'}`
                          : tipo.activo ? 'Deshabilitar' : 'Habilitar'}
                      >
                        <span>
                          <Switch
                            checked={tipo.activo}
                            disabled={bloqueado || cambiandoId === tipo.id}
                            onChange={() => cambiarEstado(tipo)}
                            size="small"
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => abrirEdicion(tipo)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
              {tipos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Aún no hay tipos de documento
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editando ? 'Editar tipo de documento' : 'Nuevo tipo de documento'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                required
                label="Código"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                placeholder="DEC"
                helperText="Corto y único"
                inputProps={{ maxLength: 20 }}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                required
                label="Nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Decreto"
                inputProps={{ maxLength: 100 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Descripción"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Para qué se usa este tipo de documento"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.requiere_firma}
                    onChange={(e) => setForm({ ...form, requiere_firma: e.target.checked })}
                  />
                }
                label="Requiere firma electrónica"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={guardar}
            disabled={saving || !form.codigo.trim() || !form.nombre.trim()}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {editando ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default TiposDocumentalesManage
