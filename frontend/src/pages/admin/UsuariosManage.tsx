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
  InputAdornment,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  CheckCircle as ActivarIcon,
  EventBusy as SubroganciaActivaIcon,
  EventAvailable as SubroganciaInactivaIcon,
  Search as SearchIcon,
  MarkEmailRead as EnviarAccesoIcon,
  AssignmentInd as DelegacionIcon,
} from '@mui/icons-material'
import { usersAPI, departamentosAPI, delegacionesEmisionAPI } from '../../api/common'
import { organigramaAPI } from '../../api/organigrama'
import { User, Departamento } from '../../types'

// Extrae un mensaje legible de un error de Axios/Laravel: prioriza los errores
// de validación (422) campo por campo y cae al `message` general o al fallback.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extraerMensajeError = (err: any, fallback: string): string => {
  const data = err?.response?.data
  if (data?.errors && typeof data.errors === 'object') {
    const mensajes = Object.values(data.errors as Record<string, string[]>).flat()
    if (mensajes.length) return mensajes.join(' ')
  }
  return data?.message || fallback
}

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
  const [search, setSearch] = useState('')
  // Selector de vista: usuarios activos o deshabilitados.
  const [vista, setVista] = useState<'activos' | 'inactivos'>('activos')

  const q = search.trim().toLowerCase()
  const filteredUsuarios = q
    ? usuarios.filter((u) =>
        [u.nombre, u.rut, u.cargo, u.email, ...(u.roles || [])]
          .some((campo) => (campo || '').toLowerCase().includes(q)),
      )
    : usuarios

  // Ordenar alfabéticamente por nombre y separar activos de inactivos.
  const ordenarPorNombre = (a: User, b: User) =>
    (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
  const usuariosActivos = filteredUsuarios.filter((u) => u.activo).sort(ordenarPorNombre)
  const usuariosInactivos = filteredUsuarios.filter((u) => !u.activo).sort(ordenarPorNombre)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [formData, setFormData] = useState({
    rut: '',
    password: '',
    nombre: '',
    cargo: '',
    email: '',
    roles: [] as string[],
    departamento_id: '',
    visador: false,
    puede_ver_registro_correspondencia: false,
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
    setSaveError('')
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
        puede_ver_registro_correspondencia: user.puede_ver_registro_correspondencia ?? false,
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
        puede_ver_registro_correspondencia: false,
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingUser(null)
    setSaveError('')
  }

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
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
      setSnackbar({
        open: true,
        severity: 'success',
        msg: editingUser ? 'Usuario actualizado' : 'Usuario creado',
      })
    } catch (err) {
      console.error('Error al guardar:', err)
      setSaveError(extraerMensajeError(err, 'No se pudo guardar el usuario'))
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

  // Enviar acceso: correo de bienvenida o restablecimiento de contraseña.
  const [accesoTarget, setAccesoTarget] = useState<User | null>(null)
  const [accesoLoading, setAccesoLoading] = useState<'bienvenida' | 'reset' | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; severity: 'success' | 'error'; msg: string }>({
    open: false, severity: 'success', msg: '',
  })

  const handleEnviarAcceso = async (tipo: 'bienvenida' | 'reset') => {
    if (!accesoTarget) return
    setAccesoLoading(tipo)
    try {
      const res = await usersAPI.enviarAcceso(accesoTarget.id, tipo)
      setSnackbar({ open: true, severity: 'success', msg: res.message || 'Correo enviado' })
      setAccesoTarget(null)
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSnackbar({ open: true, severity: 'error', msg: (err as any)?.response?.data?.message || 'No se pudo enviar el correo' })
    } finally {
      setAccesoLoading(null)
    }
  }

  // Subrogancia: dialog para activar (con fecha opcional) o desactivar.
  const [subroganciaTarget, setSubroganciaTarget] = useState<User | null>(null)
  const [subroganciaHasta, setSubroganciaHasta] = useState('')
  const [subroganteSel, setSubroganteSel] = useState<number | ''>('')
  const [subroganciaSaving, setSubroganciaSaving] = useState(false)
  const [subroganciaError, setSubroganciaError] = useState('')

  const openSubroganciaDialog = (user: User) => {
    setSubroganciaTarget(user)
    setSubroganciaHasta('')
    setSubroganteSel(user.subrogante_id ?? '')
    setSubroganciaError('')
  }

  const closeSubroganciaDialog = () => {
    setSubroganciaTarget(null)
    setSubroganciaHasta('')
    setSubroganteSel('')
    setSubroganciaError('')
  }

  // Admin: asigna/cambia el subrogante del usuario objetivo.
  const handleGuardarSubrogante = async () => {
    if (!subroganciaTarget) return
    setSubroganciaSaving(true)
    setSubroganciaError('')
    try {
      const nuevoId = subroganteSel === '' ? null : Number(subroganteSel)
      await organigramaAPI.asignarSubroganteDeUsuario(subroganciaTarget.id, nuevoId)
      // Refresca el target en memoria para habilitar/inhabilitar "Activar".
      setSubroganciaTarget((t) => (t ? { ...t, subrogante_id: nuevoId } : t))
      setSnackbar({ open: true, severity: 'success', msg: 'Subrogante actualizado' })
      loadData()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSubroganciaError((err as any)?.response?.data?.message || 'No se pudo guardar el subrogante')
    } finally {
      setSubroganciaSaving(false)
    }
  }

  const fmtUltimoAcceso = (iso?: string | null) => {
    if (!iso) return <Typography variant="caption" color="text.secondary">Nunca</Typography>
    const d = new Date(iso)
    // Hora oficial de Cabo de Hornos (Magallanes, UTC-3), independiente del navegador.
    const TZ = 'America/Punta_Arenas'
    const fecha = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ })
    const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })
    return (
      <Box sx={{ lineHeight: 1.2 }}>
        <Box>{fecha}</Box>
        <Typography variant="caption" color="text.secondary">{hora}</Typography>
      </Box>
    )
  }

  const renderUsuarioRow = (user: User) => (
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
      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 13 }}>
        {fmtUltimoAcceso(user.ultimo_acceso)}
      </TableCell>
      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
        <IconButton size="small" onClick={() => handleOpenDialog(user)}>
          <EditIcon />
        </IconButton>
        <Tooltip
          title={
            user.subrogancia_activa
              ? `Subrogancia activa${user.subrogante?.nombre ? ' · ' + user.subrogante.nombre : ''} — gestionar`
              : 'Asignar subrogante / activar subrogancia'
          }
        >
          <span>
            <IconButton
              size="small"
              onClick={() => openSubroganciaDialog(user)}
              color={user.subrogancia_activa ? 'warning' : 'default'}
            >
              {user.subrogancia_activa ? <SubroganciaActivaIcon /> : <SubroganciaInactivaIcon />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={user.email ? 'Enviar acceso (bienvenida / restablecer contraseña)' : 'El usuario no tiene correo registrado'}>
          <span>
            <IconButton
              size="small"
              color="primary"
              onClick={() => setAccesoTarget(user)}
              disabled={!user.email}
            >
              <EnviarAccesoIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Delegación de emisión (emitir documentos en nombre de…)">
          <IconButton size="small" onClick={() => openDelegacionDialog(user)}>
            <DelegacionIcon />
          </IconButton>
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
  )

  const renderTablaUsuarios = (titulo: string, lista: User[], emptyMsg: string) => (
    <Card sx={{ mb: 3 }}>
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          {titulo}
        </Typography>
        <Chip label={lista.length} size="small" />
      </Box>
      <TableContainer>
        <Table
          size="small"
          sx={{
            minWidth: 1040,
            tableLayout: 'fixed',
            '& td, & th': { py: 1 },
          }}
        >
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: 176 }} />
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
              <TableCell>Último acceso</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lista.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">{emptyMsg}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              lista.map(renderUsuarioRow)
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )

  // Delegación de emisión: qué titulares puede representar este usuario al crear
  // documentos de Cero Papel (ej. la secretaria emite en nombre del Alcalde).
  const [delegacionTarget, setDelegacionTarget] = useState<User | null>(null)
  const [titularesSel, setTitularesSel] = useState<User[]>([])
  const [delegacionLoading, setDelegacionLoading] = useState(false)

  const openDelegacionDialog = async (u: User) => {
    setDelegacionTarget(u)
    setTitularesSel([])
    try {
      const res = await delegacionesEmisionAPI.listar()
      const encontrado = res.data.find((d) => d.delegado.id === u.id)
      if (encontrado) {
        const ids = encontrado.titulares.map((t) => t.id)
        setTitularesSel(usuarios.filter((x) => ids.includes(x.id)))
      }
    } catch (err) {
      console.error('No se pudieron cargar las delegaciones:', err)
    }
  }

  const handleGuardarDelegacion = async () => {
    if (!delegacionTarget) return
    setDelegacionLoading(true)
    try {
      await delegacionesEmisionAPI.actualizar(delegacionTarget.id, titularesSel.map((t) => t.id))
      setSnackbar({ open: true, severity: 'success', msg: 'Delegación de emisión actualizada' })
      setDelegacionTarget(null)
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSnackbar({ open: true, severity: 'error', msg: (err as any)?.response?.data?.message || 'No se pudo guardar la delegación' })
    } finally {
      setDelegacionLoading(false)
    }
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

      <TextField
        fullWidth
        size="small"
        placeholder="Buscar por nombre, RUT, cargo, email o rol"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: 480 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <ToggleButtonGroup
        size="small"
        exclusive
        color="primary"
        value={vista}
        onChange={(_, v) => { if (v) setVista(v) }}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="activos">Activos ({usuariosActivos.length})</ToggleButton>
        <ToggleButton value="inactivos">Deshabilitados ({usuariosInactivos.length})</ToggleButton>
      </ToggleButtonGroup>

      {loading ? (
        <Card>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        </Card>
      ) : vista === 'activos' ? (
        renderTablaUsuarios(
          'Usuarios activos',
          usuariosActivos,
          search ? 'No se encontraron usuarios activos para la búsqueda' : 'No hay usuarios activos',
        )
      ) : (
        renderTablaUsuarios(
          'Usuarios deshabilitados',
          usuariosInactivos,
          search ? 'No se encontraron usuarios deshabilitados para la búsqueda' : 'No hay usuarios deshabilitados',
        )
      )}

      {/* Dialog de creación/edición */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        </DialogTitle>
        <DialogContent>
          {saveError && (
            <Alert severity="error" sx={{ mt: 1, mb: 1 }} onClose={() => setSaveError('')}>
              {saveError}
            </Alert>
          )}
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
                helperText="Mínimo 6 caracteres"
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
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.puede_ver_registro_correspondencia}
                    onChange={(e) => handleChange('puede_ver_registro_correspondencia', e.target.checked)}
                  />
                }
                label="Puede ver el registro de correspondencia (solo lectura, todas)"
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
        <DialogTitle>Subrogancia · {subroganciaTarget?.nombre}</DialogTitle>
        <DialogContent>
          {/* Paso 1: asignar el subrogante */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Subrogante asignado</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Subrogante"
              value={subroganteSel}
              onChange={(e) => setSubroganteSel(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={subroganciaSaving}
            >
              <MenuItem value="">— Sin asignar —</MenuItem>
              {usuarios
                .filter((u) => u.activo && u.id !== subroganciaTarget?.id)
                .sort(ordenarPorNombre)
                .map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.nombre}{u.cargo ? ` · ${u.cargo}` : ''}
                  </MenuItem>
                ))}
            </TextField>
            <Button
              variant="outlined"
              onClick={handleGuardarSubrogante}
              disabled={subroganciaSaving || subroganteSel === (subroganciaTarget?.subrogante_id ?? '')}
              sx={{ mt: 0.25, whiteSpace: 'nowrap' }}
            >
              Guardar
            </Button>
          </Box>

          {/* Paso 2: activar / desactivar */}
          {subroganciaTarget?.subrogancia_activa ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              La subrogancia está <strong>activa</strong>: su subrogante está actuando en su nombre.
            </Alert>
          ) : (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Activar subrogancia</Typography>
              {!subroganciaTarget?.subrogante_id && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Asigna y guarda primero un subrogante para poder activar la subrogancia.
                </Alert>
              )}
              <TextField
                fullWidth
                size="small"
                type="datetime-local"
                label="Hasta (opcional)"
                value={subroganciaHasta}
                onChange={(e) => setSubroganciaHasta(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Si lo dejas vacío, queda activa hasta que la desactives."
                disabled={!subroganciaTarget?.subrogante_id}
              />
            </>
          )}
          {subroganciaError && (
            <Alert severity="error" sx={{ mt: 2 }}>{subroganciaError}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSubroganciaDialog} disabled={subroganciaSaving}>Cerrar</Button>
          <Button
            variant="contained"
            color={subroganciaTarget?.subrogancia_activa ? 'error' : 'warning'}
            onClick={handleConfirmSubrogancia}
            disabled={subroganciaSaving || (!subroganciaTarget?.subrogancia_activa && !subroganciaTarget?.subrogante_id)}
            startIcon={subroganciaSaving ? <CircularProgress size={16} /> : null}
          >
            {subroganciaTarget?.subrogancia_activa ? 'Desactivar' : 'Activar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enviar acceso: correo de bienvenida o restablecer contraseña */}
      <Dialog open={!!accesoTarget} onClose={() => accesoLoading || setAccesoTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Enviar acceso · {accesoTarget?.nombre}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            Se enviará un correo a <strong>{accesoTarget?.email}</strong> con una contraseña temporal.
            En ambos casos el usuario deberá cambiarla en su próximo inicio de sesión.
          </DialogContentText>
          <Alert severity="info" sx={{ mb: 1 }}>
            <strong>Correo de bienvenida</strong>: incorporación a la plataforma, con instrucciones de
            certificado SSL y red municipal.<br />
            <strong>Restablecer contraseña</strong>: solo entrega la nueva clave temporal.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setAccesoTarget(null)} disabled={!!accesoLoading}>Cancelar</Button>
          <Button
            variant="outlined"
            onClick={() => handleEnviarAcceso('reset')}
            disabled={!!accesoLoading}
            startIcon={accesoLoading === 'reset' ? <CircularProgress size={18} /> : undefined}
          >
            Restablecer contraseña
          </Button>
          <Button
            variant="contained"
            onClick={() => handleEnviarAcceso('bienvenida')}
            disabled={!!accesoLoading}
            startIcon={accesoLoading === 'bienvenida' ? <CircularProgress size={18} /> : <EnviarAccesoIcon />}
          >
            Correo de bienvenida
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delegación de emisión: en nombre de quién puede emitir documentos */}
      <Dialog open={!!delegacionTarget} onClose={() => !delegacionLoading && setDelegacionTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Delegación de emisión · {delegacionTarget?.nombre}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Selecciona en nombre de qué personas <strong>{delegacionTarget?.nombre}</strong> podrá crear
            documentos de Cero Papel. Al elegirlas en el formulario, el titular aparecerá en el campo
            «DE:» y quedará asignado como firmante (él firma con su clave). La autoría real se registra
            como {delegacionTarget?.nombre}.
          </DialogContentText>
          <Autocomplete
            multiple
            options={usuarios.filter((u) => u.activo && u.id !== delegacionTarget?.id).sort(ordenarPorNombre)}
            getOptionLabel={(u) => `${u.nombre}${u.cargo ? ' · ' + u.cargo : ''}`}
            value={titularesSel}
            onChange={(_, v) => setTitularesSel(v)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} label="Emitir en nombre de" placeholder="Buscar persona…" />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip {...getTagProps({ index })} key={option.id} label={option.nombre} size="small" />
              ))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelegacionTarget(null)} disabled={delegacionLoading}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleGuardarDelegacion}
            disabled={delegacionLoading}
            startIcon={delegacionLoading ? <CircularProgress size={16} /> : null}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default UsuariosManage
