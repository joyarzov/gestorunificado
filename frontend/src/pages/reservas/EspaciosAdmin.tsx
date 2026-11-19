import { useEffect, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  IconButton,
  Divider,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Block as BlockIcon } from '@mui/icons-material'
import { reservasAPI, EspacioInput } from '../../api/reservas'
import { usersAPI } from '../../api/common'
import { Espacio, User } from '../../types'

const COLORES = ['#6A1B9A', '#0071BC', '#2DC700', '#EB1B78', '#EE5825', '#28A9E3', '#8AC53E']

const EspaciosAdmin = () => {
  const [espacios, setEspacios] = useState<Espacio[]>([])
  const [puedeGestionar, setPuedeGestionar] = useState(false)
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Espacio | null>(null)
  const [form, setForm] = useState<EspacioInput>({ nombre: '', color: COLORES[0] })
  const [admins, setAdmins] = useState<User[]>([])
  const [saving, setSaving] = useState(false)

  const cargar = async () => {
    setLoading(true)
    setError('')
    try {
      const [esp, users] = await Promise.all([
        reservasAPI.espaciosListar(true),
        usersAPI.funcionarios(),
      ])
      setEspacios(esp.data.espacios)
      setPuedeGestionar(esp.data.puede_gestionar)
      setUsuarios(users.data)
    } catch {
      setError('No se pudieron cargar los espacios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: '', descripcion: '', ubicacion: '', capacidad: null, color: COLORES[0], activo: true })
    setAdmins([])
    setDialogOpen(true)
  }

  const abrirEditar = (e: Espacio) => {
    setEditando(e)
    setForm({
      nombre: e.nombre,
      descripcion: e.descripcion ?? '',
      ubicacion: e.ubicacion ?? '',
      capacidad: e.capacidad ?? null,
      color: e.color,
      activo: e.activo,
    })
    const ids = (e.administradores || []).map((a) => a.id)
    setAdmins(usuarios.filter((u) => ids.includes(u.id)))
    setDialogOpen(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true)
    setError('')
    try {
      const payload: EspacioInput = { ...form, administrador_ids: admins.map((a) => a.id) }
      if (editando) {
        await reservasAPI.espacioActualizar(editando.id, payload)
      } else {
        await reservasAPI.espacioCrear(payload)
      }
      setDialogOpen(false)
      await cargar()
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo guardar el espacio.')
    } finally {
      setSaving(false)
    }
  }

  const desactivar = async (e: Espacio) => {
    if (!window.confirm(`¿Desactivar el espacio "${e.nombre}"? No se eliminarán sus reservas históricas.`)) return
    try {
      await reservasAPI.espacioEliminar(e.id)
      await cargar()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo desactivar.')
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Espacios</Typography>
        {puedeGestionar && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={abrirNuevo}>Nuevo espacio</Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <Stack spacing={2}>
          {espacios.map((e) => (
            <Card key={e.id} sx={{ opacity: e.activo ? 1 : 0.6 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: e.color }} />
                      <Typography variant="h6">{e.nombre}</Typography>
                      {!e.activo && <Chip label="Inactivo" size="small" />}
                    </Box>
                    {e.ubicacion && <Typography variant="body2" color="text.secondary">{e.ubicacion}</Typography>}
                    {e.descripcion && <Typography variant="body2" sx={{ mt: 0.5 }}>{e.descripcion}</Typography>}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      {(e.administradores || []).length === 0 ? (
                        <Typography variant="caption" color="text.secondary">Sin administradores asignados</Typography>
                      ) : (
                        (e.administradores || []).map((a) => (
                          <Chip key={a.id} label={`Admin: ${a.nombre}`} size="small" variant="outlined" />
                        ))
                      )}
                    </Box>
                  </Box>
                  {e.es_administrador && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton onClick={() => abrirEditar(e)} title="Editar"><EditIcon /></IconButton>
                      {e.activo && (
                        <IconButton color="error" onClick={() => desactivar(e)} title="Desactivar"><BlockIcon /></IconButton>
                      )}
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
          {espacios.length === 0 && <Alert severity="info">No hay espacios. Crea el primero.</Alert>}
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editando ? 'Editar espacio' : 'Nuevo espacio'}</DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required fullWidth />
            <TextField label="Ubicación" value={form.ubicacion ?? ''} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} fullWidth />
            <TextField label="Capacidad (opcional)" type="number" value={form.capacidad ?? ''} onChange={(e) => setForm({ ...form, capacidad: e.target.value ? Number(e.target.value) : null })} fullWidth />
            <TextField label="Descripción" value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} multiline rows={2} fullWidth />
            <Box>
              <Typography variant="caption" color="text.secondary">Color en el calendario</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                {COLORES.map((c) => (
                  <Box
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    sx={{
                      width: 28, height: 28, borderRadius: '6px', bgcolor: c, cursor: 'pointer',
                      border: form.color === c ? '3px solid #000' : '2px solid transparent',
                    }}
                  />
                ))}
              </Box>
            </Box>
            <Autocomplete
              multiple
              options={usuarios}
              getOptionLabel={(opt) => `${opt.nombre}${opt.cargo ? ` (${opt.cargo})` : ''}`}
              value={admins}
              onChange={(_, value) => setAdmins(value)}
              isOptionEqualToValue={(opt, value) => opt.id === value.id}
              renderInput={(params) => (
                <TextField {...params} label="Administradores del espacio" helperText="Pueden crear reservas directas y aprobar solicitudes. Tú quedas incluido automáticamente." />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={guardar} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default EspaciosAdmin
