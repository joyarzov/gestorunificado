import { useState, useEffect } from 'react'
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
  DialogContentText,
  TextField,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  CheckCircle as ActivarIcon,
  EventBusy as SubroganciaActivaIcon,
  EventAvailable as SubroganciaInactivaIcon,
} from '@mui/icons-material'
import { usersAPI, departamentosAPI } from '../../api/common'
import { organigramaAPI } from '../../api/organigrama'
import { User, Departamento } from '../../types'

const rolesOptions = [
  { value: 'admin', label: 'Administrador' },
  { value: 'alcalde', label: 'Alcalde' },
  { value: 'oficial', label: 'Oficial de Partes' },
  { value: 'oirs', label: 'Administrador OIRS' },
  { value: 'fomento_productivo', label: 'Fomento Productivo' },
  { value: 'usuario', label: 'Usuario' },
]

const UsuariosManage = () => {
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    rut: '',
    password: '',
    nombre: '',
    cargo: '',
    email: '',
    roles: [] as string[],
    departamento_id: '',
    visador: false,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, deptosRes] = await Promise.all([
        usersAPI.listar(),
        departamentosAPI.listar(),
      ])
      setUsuarios(usersRes.data.data)
      setDepartamentos(deptosRes.data)
    } catch (err) {
      setError('Error al cargar datos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        rut: user.rut,
        password: '',
        nombre: user.nombre,
        cargo: user.cargo || '',
        email: user.email || '',
        roles: user.roles || [],
        departamento_id: user.departamento_id?.toString() || '',
        visador: user.visador,
      })
    } else {
      setEditingUser(null)
      setFormData({
        rut: '',
        password: '',
        nombre: '',
        cargo: '',
        email: '',
        roles: ['usuario'],
        departamento_id: '',
        visador: false,
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingUser(null)
  }

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data: Record<string, unknown> = {
        ...formData,
        departamento_id: formData.departamento_id ? Number(formData.departamento_id) : undefined,
      }

      // No enviar password vacío al editar (solo si el admin escribió una nueva)
      if (editingUser && !formData.password) {
        delete data.password
      }

      if (editingUser) {
        await usersAPI.actualizar(editingUser.id, data)
      } else {
        await usersAPI.crear(data)
      }
      loadData()
      handleCloseDialog()
    } catch (err) {
      console.error('Error al guardar:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      if (user.activo) {
        await usersAPI.desactivar(user.id)
      } else {
        await usersAPI.activar(user.id)
      }
      loadData()
    } catch (err) {
      console.error('Error:', err)
    }
  }

  // Subrogancia: dialog para activar (con fecha opcional) o desactivar.
  const [subroganciaTarget, setSubroganciaTarget] = useState<User | null>(null)
  const [subroganciaHasta, setSubroganciaHasta] = useState('')
  const [subroganciaSaving, setSubroganciaSaving] = useState(false)
  const [subroganciaError, setSubroganciaError] = useState('')

  const openSubroganciaDialog = (user: User) => {
    setSubroganciaTarget(user)
    setSubroganciaHasta('')
    setSubroganciaError('')
  }

  const closeSubroganciaDialog = () => {
    setSubroganciaTarget(null)
    setSubroganciaHasta('')
    setSubroganciaError('')
  }

  const handleConfirmSubrogancia = async () => {
    if (!subroganciaTarget) return
    setSubroganciaSaving(true)
    setSubroganciaError('')
    try {
      if (subroganciaTarget.subrogancia_activa) {
        await organigramaAPI.desactivarSubroganciaDeUsuario(subroganciaTarget.id)
      } else {
        await organigramaAPI.activarSubroganciaDeUsuario(subroganciaTarget.id, {
          hasta: subroganciaHasta || null,
        })
      }
      closeSubroganciaDialog()
      loadData()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSubroganciaError((err as any)?.response?.data?.message || 'Error al cambiar subrogancia')
    } finally {
      setSubroganciaSaving(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Gestión de Usuarios
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Usuario
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table
            size="small"
            sx={{
              minWidth: 860,
              tableLayout: 'fixed',
              '& td, & th': { py: 1 },
            }}
          >
            <colgroup>
              <col style={{ width: '11%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: 132 }} />
            </colgroup>
            <TableHead>
              <TableRow>
                <TableCell>RUT</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Departamento</TableCell>
                <TableCell>Roles</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay usuarios
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.rut}</TableCell>
                    <TableCell>{user.nombre}</TableCell>
                    <TableCell>{user.cargo || '-'}</TableCell>
                    <TableCell sx={{ wordBreak: 'break-word' }}>{user.email || '-'}</TableCell>
                    <TableCell>{user.departamento?.nombre || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {user.roles?.map((role) => (
                          <Chip key={role} label={role} size="small" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.activo ? 'Activo' : 'Inactivo'}
                        color={user.activo ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton size="small" onClick={() => handleOpenDialog(user)}>
                        <EditIcon />
                      </IconButton>
                      <Tooltip
                        title={
                          !user.subrogante_id
                            ? 'El usuario no tiene subrogante asignado'
                            : user.subrogancia_activa
                              ? 'Desactivar subrogancia (el subrogado ha vuelto)'
                              : 'Activar subrogancia (marcar como ausente)'
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => openSubroganciaDialog(user)}
                            disabled={!user.subrogante_id}
                            color={user.subrogancia_activa ? 'warning' : 'default'}
                          >
                            {user.subrogancia_activa ? <SubroganciaActivaIcon /> : <SubroganciaInactivaIcon />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleActive(user)}
                        color={user.activo ? 'error' : 'success'}
                      >
                        {user.activo ? <BlockIcon /> : <ActivarIcon />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Dialog de creación/edición */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="RUT"
                value={formData.rut}
                onChange={(e) => handleChange('rut', e.target.value)}
                disabled={!!editingUser}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={editingUser ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña'}
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required={!editingUser}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre"
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Cargo"
                value={formData.cargo}
                onChange={(e) => handleChange('cargo', e.target.value)}
                placeholder="Ej: Jefe de Departamento, Secretario Municipal..."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Departamento"
                value={formData.departamento_id}
                onChange={(e) => handleChange('departamento_id', e.target.value)}
              >
                <MenuItem value="">Sin asignar</MenuItem>
                {departamentos.map((depto) => (
                  <MenuItem key={depto.id} value={depto.id}>
                    {depto.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Roles"
                value={formData.roles}
                onChange={(e) => handleChange('roles', e.target.value as unknown as string[])}
                SelectProps={{ multiple: true }}
              >
                {rolesOptions.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.visador}
                    onChange={(e) => handleChange('visador', e.target.checked)}
                  />
                }
                label="Puede visar documentos"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.nombre || !formData.rut || (!editingUser && !formData.password)}
          >
            {saving ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de subrogancia (activar/desactivar) */}
      <Dialog open={!!subroganciaTarget} onClose={closeSubroganciaDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {subroganciaTarget?.subrogancia_activa ? 'Desactivar subrogancia' : 'Activar subrogancia'}
        </DialogTitle>
        <DialogContent>
          {subroganciaTarget?.subrogancia_activa ? (
            <DialogContentText>
              Desactivar la subrogancia de <strong>{subroganciaTarget.nombre}</strong>. A partir
              de este momento, su subrogante dejará de actuar en su nombre.
            </DialogContentText>
          ) : (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Activar la subrogancia de <strong>{subroganciaTarget?.nombre}</strong>.
                Su subrogante recibirá su bandeja y podrá actuar en su nombre.
              </DialogContentText>
              <TextField
                fullWidth
                type="datetime-local"
                label="Hasta (opcional)"
                value={subroganciaHasta}
                onChange={(e) => setSubroganciaHasta(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Si lo dejas vacío, la subrogancia queda activa hasta que la desactives."
              />
            </>
          )}
          {subroganciaError && (
            <Alert severity="error" sx={{ mt: 2 }}>{subroganciaError}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSubroganciaDialog} disabled={subroganciaSaving}>Cancelar</Button>
          <Button
            variant="contained"
            color={subroganciaTarget?.subrogancia_activa ? 'error' : 'warning'}
            onClick={handleConfirmSubrogancia}
            disabled={subroganciaSaving}
            startIcon={subroganciaSaving ? <CircularProgress size={16} /> : null}
          >
            {subroganciaTarget?.subrogancia_activa ? 'Desactivar' : 'Activar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UsuariosManage
