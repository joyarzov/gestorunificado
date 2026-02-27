import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Button,
  Typography,
  Box,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { PostulacionItemFinanciamiento } from '../../types'

const SUB_ITEMS = [
  { value: 'activo_fijo', label: 'Activo Fijo' },
  { value: 'activo_intangible', label: 'Activo Intangible' },
  { value: 'materia_prima', label: 'Materia Prima' },
  { value: 'mercaderia', label: 'Mercadería' },
  { value: 'promocion', label: 'Promoción' },
  { value: 'transporte', label: 'Transporte' },
]

interface FinanciamientoTableProps {
  items: Partial<PostulacionItemFinanciamiento>[]
  onChange: (items: Partial<PostulacionItemFinanciamiento>[]) => void
  readOnly?: boolean
}

const FinanciamientoTable = ({ items, onChange, readOnly = false }: FinanciamientoTableProps) => {
  const handleAddItem = () => {
    onChange([
      ...items,
      {
        sub_item: 'activo_fijo',
        producto_servicio: '',
        justificacion: '',
        plazo_ejecucion: '',
        numero_cotizacion: '',
        proveedor: '',
        cantidad: 1,
        valor_unitario: 0,
        valor_total: 0,
        monto_municipio: 0,
        monto_cofinanciamiento: 0,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const handleChange = (index: number, field: string, value: string | number) => {
    const updated = [...items]
    const item = { ...updated[index], [field]: value }

    // Auto-calcular valor_total
    if (field === 'cantidad' || field === 'valor_unitario') {
      item.valor_total = (Number(item.cantidad) || 0) * (Number(item.valor_unitario) || 0)
    }

    updated[index] = item
    onChange(updated)
  }

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monto)
  }

  const totalMunicipio = items.reduce((sum, i) => sum + (Number(i.monto_municipio) || 0), 0)
  const totalCofinanciamiento = items.reduce((sum, i) => sum + (Number(i.monto_cofinanciamiento) || 0), 0)
  const totalGeneral = items.reduce((sum, i) => sum + (Number(i.valor_total) || 0), 0)

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Plan de Financiamiento (Anexo II)
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell>Sub-ítem</TableCell>
              <TableCell>Producto/Servicio</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell>N° Cotización</TableCell>
              <TableCell align="right">Cant.</TableCell>
              <TableCell align="right">V. Unitario</TableCell>
              <TableCell align="right">V. Total</TableCell>
              <TableCell align="right">Municipio</TableCell>
              <TableCell align="right">Cofinan.</TableCell>
              {!readOnly && <TableCell width={50} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  {readOnly ? (
                    SUB_ITEMS.find(s => s.value === item.sub_item)?.label || item.sub_item
                  ) : (
                    <Select
                      size="small"
                      value={item.sub_item || 'activo_fijo'}
                      onChange={(e) => handleChange(index, 'sub_item', e.target.value)}
                      fullWidth
                      sx={{ minWidth: 120 }}
                    >
                      {SUB_ITEMS.map(s => (
                        <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                      ))}
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  {readOnly ? item.producto_servicio : (
                    <TextField
                      size="small"
                      value={item.producto_servicio || ''}
                      onChange={(e) => handleChange(index, 'producto_servicio', e.target.value)}
                      fullWidth
                    />
                  )}
                </TableCell>
                <TableCell>
                  {readOnly ? item.proveedor : (
                    <TextField
                      size="small"
                      value={item.proveedor || ''}
                      onChange={(e) => handleChange(index, 'proveedor', e.target.value)}
                      fullWidth
                    />
                  )}
                </TableCell>
                <TableCell>
                  {readOnly ? item.numero_cotizacion : (
                    <TextField
                      size="small"
                      value={item.numero_cotizacion || ''}
                      onChange={(e) => handleChange(index, 'numero_cotizacion', e.target.value)}
                      sx={{ width: 100 }}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  {readOnly ? item.cantidad : (
                    <TextField
                      size="small"
                      type="number"
                      value={item.cantidad || ''}
                      onChange={(e) => handleChange(index, 'cantidad', parseInt(e.target.value) || 0)}
                      sx={{ width: 70 }}
                      inputProps={{ min: 1 }}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  {readOnly ? formatMonto(Number(item.valor_unitario) || 0) : (
                    <TextField
                      size="small"
                      type="number"
                      value={item.valor_unitario || ''}
                      onChange={(e) => handleChange(index, 'valor_unitario', parseInt(e.target.value) || 0)}
                      sx={{ width: 100 }}
                      inputProps={{ min: 0 }}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {formatMonto(Number(item.valor_total) || 0)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {readOnly ? formatMonto(Number(item.monto_municipio) || 0) : (
                    <TextField
                      size="small"
                      type="number"
                      value={item.monto_municipio || ''}
                      onChange={(e) => handleChange(index, 'monto_municipio', parseInt(e.target.value) || 0)}
                      sx={{ width: 100 }}
                      inputProps={{ min: 0 }}
                    />
                  )}
                </TableCell>
                <TableCell align="right">
                  {readOnly ? formatMonto(Number(item.monto_cofinanciamiento) || 0) : (
                    <TextField
                      size="small"
                      type="number"
                      value={item.monto_cofinanciamiento || ''}
                      onChange={(e) => handleChange(index, 'monto_cofinanciamiento', parseInt(e.target.value) || 0)}
                      sx={{ width: 100 }}
                      inputProps={{ min: 0 }}
                    />
                  )}
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    <IconButton size="small" color="error" onClick={() => handleRemoveItem(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={readOnly ? 9 : 10} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No hay ítems de financiamiento
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {/* Totales */}
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell colSpan={6} align="right">
                <Typography variant="body2" fontWeight="bold">Totales:</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="bold">{formatMonto(totalGeneral)}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="bold">{formatMonto(totalMunicipio)}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="bold">{formatMonto(totalCofinanciamiento)}</Typography>
              </TableCell>
              {!readOnly && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {!readOnly && (
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddItem}
          sx={{ mt: 1 }}
          size="small"
        >
          Agregar ítem
        </Button>
      )}
    </Box>
  )
}

export default FinanciamientoTable
