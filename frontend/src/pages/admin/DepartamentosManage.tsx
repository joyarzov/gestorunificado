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
  Grid,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
} from '@mui/icons-material'
import { departamentosAPI } from '../../api/common'
import { Departamento } from '../../types'

const DepartamentosManage = () => {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDepto, setEditingDepto] = useState<Departamento | null>(null)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await departamentosAPI.listar()
      setDepartamentos(response.data)
    } catch (err) {
      setError('Error al cargar departamentos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (depto?: Departamento) => {
    if (depto) {
      setEditingDepto(depto)
      setFormData({
        nombre: depto.nombre,
        codigo: depto.codigo || '',
      })
    } else {
      setEditingDepto(null)
      setFormData({
        nombre: '',
        codigo: '',
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingDepto(null)
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editingDepto) {
        await departamentosAPI.actualizar(editingDepto.id, formData)
      } else {
        await departamentosAPI.crear(formData)
      }
      loadData()
      handleCloseDialog()
    } catch (err) {
      console.error('Error al guardar:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Gestión de Departamentos
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Departamento
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table sx={{ minWidth: 500 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Código</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : departamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay departamentos
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                departamentos.map((depto) => (
                  <TableRow key={depto.id} hover>
                    <TableCell>{depto.id}</TableCell>
                    <TableCell>{depto.codigo || '-'}</TableCell>
                    <TableCell>{depto.nombre}</TableCell>
                    <TableCell>
                      <Chip
                        label={depto.activo ? 'Activo' : 'Inactivo'}
                        color={depto.activo ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpenDialog(depto)}>
                        <EditIcon />
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
          {editingDepto ? 'Editar Departamento' : 'Nuevo Departamento'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
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
                label="Código"
                value={formData.codigo}
                onChange={(e) => handleChange('codigo', e.target.value.toUpperCase())}
                placeholder="Ej: SECMU, DOM, FIN"
                helperText="Código abreviado del departamento"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !formData.nombre}
          >
            {saving ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default DepartamentosManage
