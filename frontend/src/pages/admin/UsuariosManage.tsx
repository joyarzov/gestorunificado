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
  TextField,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  CheckCircle as ActivarIcon,
} from '@mui/icons-material'
import { usersAPI, departamentosAPI } from '../../api/common'
import { User, Departamento } from '../../types'

const rolesOptions = [
  { value: 'admin', label: 'Administrador' },
  { value: 'alcalde', label: 'Alcalde' },
  { value: 'oficial', label: 'Oficial de Partes' },
  { value: 'oirs', label: 'Administrador OIRS' },
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
          <Table>
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
                    <TableCell>{user.rut}</TableCell>
                    <TableCell>{user.nombre}</TableCell>
                    <TableCell>{user.cargo || '-'}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.departamento?.nombre || '-'}</TableCell>
                    <TableCell>
                      {user.roles?.map((role) => (
                        <Chip key={role} label={role} size="small" sx={{ mr: 0.5 }} />
                      ))}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.activo ? 'Activo' : 'Inactivo'}
                        color={user.activo ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpenDialog(user)}>
                        <EditIcon />
                      </IconButton>
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
    </Box>
  )
}

export default UsuariosManage
