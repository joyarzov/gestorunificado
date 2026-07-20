import {
  Autocomplete,
  Box,
  Chip,
  FormControl,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import type { User } from '../../types'

/**
 * Selector de firmantes con la CALIDAD en que firma cada uno.
 *
 * Un funcionario puede firmar por sí mismo o en subrogancia de un titular
 * ausente. Antes esa distinción dependía de si el usuario tenía encendido el
 * modo subrogante al momento de firmar, lo que dejaba el "(S)" del sello a
 * merced de la sesión. Aquí la calidad se declara al asignar y queda guardada
 * con el documento.
 *
 * Solo se ofrece la opción a quienes tienen una subrogancia vigente hoy
 * (`subrogaciones_vigentes`, que resuelve el backend).
 */
interface Props {
  funcionarios: User[]
  firmantes: User[]
  /** { [firmante_id]: titular_id } — solo para quienes firman en subrogancia. */
  subrogancias: Record<number, number>
  onChange: (firmantes: User[], subrogancias: Record<number, number>) => void
  disabled?: boolean
  helperText?: string
}

export default function SelectorFirmantes({
  funcionarios,
  firmantes,
  subrogancias,
  onChange,
  disabled = false,
  helperText = 'Firmarán en el orden en que los agregas (firma secuencial: cada uno firma cuando el anterior ya firmó).',
}: Props) {
  const handleFirmantesChange = (nuevos: User[]) => {
    // Al quitar un firmante se descarta también su calidad, para no dejar
    // subrogancias colgando de alguien que ya no está en la lista.
    const idsVigentes = new Set(nuevos.map((f) => f.id))
    const limpias = Object.fromEntries(
      Object.entries(subrogancias).filter(([id]) => idsVigentes.has(Number(id)))
    ) as Record<number, number>

    onChange(nuevos, limpias)
  }

  const handleCalidadChange = (firmanteId: number) => (e: SelectChangeEvent<string>) => {
    const valor = e.target.value
    const siguientes = { ...subrogancias }
    if (valor === 'propia') {
      delete siguientes[firmanteId]
    } else {
      siguientes[firmanteId] = Number(valor)
    }
    onChange(firmantes, siguientes)
  }

  return (
    <>
      <Autocomplete
        multiple
        disabled={disabled}
        options={funcionarios}
        getOptionLabel={(option) => `${option.nombre} (${option.rut})`}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        value={firmantes}
        onChange={(_, newValue) => handleFirmantesChange(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Seleccionar firmantes"
            placeholder="Buscar funcionario..."
            helperText={helperText}
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              label={`${index + 1}. ${option.nombre}`}
              {...getTagProps({ index })}
              key={option.id}
            />
          ))
        }
      />

      {/* Calidad de firma: solo aparece para quienes efectivamente subrogan a alguien hoy. */}
      {firmantes.some((f) => (f.subrogaciones_vigentes?.length ?? 0) > 0) && (
        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Calidad en que firma
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Si la subrogancia termina antes de que firme, el turno vuelve automáticamente al titular.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {firmantes
              .filter((f) => (f.subrogaciones_vigentes?.length ?? 0) > 0)
              .map((f) => {
                const titularId = subrogancias[f.id]
                // El sello lleva el cargo SUBROGADO: se firma el cargo que se
                // subroga, no el propio.
                const titular = f.subrogaciones_vigentes?.find((t) => t.id === titularId)
                const cargoSello = titularId
                  ? `${titular?.cargo || f.cargo || 'Sin cargo'} (S)`
                  : f.cargo || 'Sin cargo'

                return (
                  <Box
                    key={f.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
                  >
                    <Typography variant="body2" sx={{ minWidth: 180 }}>
                      {f.nombre}
                    </Typography>

                    <FormControl size="small" sx={{ minWidth: 280 }} disabled={disabled}>
                      <Select
                        value={titularId ? String(titularId) : 'propia'}
                        onChange={handleCalidadChange(f.id)}
                      >
                        <MenuItem value="propia">
                          Calidad propia — {f.cargo || 'sin cargo'}
                        </MenuItem>
                        {f.subrogaciones_vigentes?.map((t) => (
                          <MenuItem key={t.id} value={String(t.id)}>
                            En subrogancia de {t.nombre}
                            {t.cargo ? ` — firma como ${t.cargo} (S)` : ''}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Chip
                      size="small"
                      variant="outlined"
                      color={titularId ? 'primary' : 'default'}
                      label={`Sello: ${cargoSello}`}
                    />
                  </Box>
                )
              })}
          </Box>
        </Paper>
      )}
    </>
  )
}
