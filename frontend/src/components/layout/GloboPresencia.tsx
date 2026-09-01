import { useState } from 'react'
import {
  Badge,
  Box,
  CircularProgress,
  Divider,
  Fab,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Popover,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { People as PeopleIcon } from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePresencia } from '../../hooks/usePresencia'
import { EstadoPresencia, UsuarioPresencia } from '../../api/common'
import { useAuth } from '../../contexts/AuthContext'

const COLOR_ESTADO: Record<EstadoPresencia, string> = {
  en_linea: '#2DC700',   // verde de la barra corporativa
  ausente: '#EE5825',    // naranjo
  desconectado: '#BDBDBD',
}

/** Punto de color del estado. Se exporta para reutilizarlo junto a nombres en otras pantallas. */
export const PuntoPresencia = ({ estado, size = 10 }: { estado: EstadoPresencia; size?: number }) => (
  <Box
    component="span"
    sx={{
      width: size,
      height: size,
      borderRadius: '50%',
      bgcolor: COLOR_ESTADO[estado],
      flexShrink: 0,
      display: 'inline-block',
      border: estado === 'desconectado' ? '1px solid #9e9e9e' : 'none',
    }}
  />
)

const iniciales = (nombre: string) =>
  nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')

const Fila = ({ u }: { u: UsuarioPresencia }) => (
  <ListItem sx={{ py: 0.5 }}>
    <ListItemAvatar sx={{ minWidth: 40 }}>
      <Box sx={{ position: 'relative' }}>
        <Box
          sx={{
            width: 30, height: 30, borderRadius: '50%',
            bgcolor: u.estado === 'desconectado' ? 'grey.300' : 'primary.main',
            color: u.estado === 'desconectado' ? 'text.secondary' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}
        >
          {iniciales(u.nombre)}
        </Box>
        <Box sx={{ position: 'absolute', bottom: -1, right: -1, bgcolor: '#fff', borderRadius: '50%', p: '2px', lineHeight: 0 }}>
          <PuntoPresencia estado={u.estado} size={9} />
        </Box>
      </Box>
    </ListItemAvatar>
    <ListItemText
      primary={<Typography variant="body2" fontWeight={u.estado === 'en_linea' ? 600 : 400}>{u.nombre}</Typography>}
      secondary={
        <Typography variant="caption" color="text.secondary">
          {[u.cargo, u.departamento].filter(Boolean).join(' · ') || '—'}
          {u.estado !== 'en_linea' && u.visto_at && (
            <> · activo hace {formatDistanceToNow(new Date(u.visto_at), { locale: es })}</>
          )}
        </Typography>
      }
    />
  </ListItem>
)

/**
 * Globo flotante con quién está conectado a la plataforma.
 *
 * Vive en el layout, así que acompaña al usuario mientras navega entre
 * Correspondencia, Expedientes, Cero Papel y el resto de los módulos, sin
 * recargarse al cambiar de sección.
 *
 * No se muestra en pantallas chicas: en el celular taparía los botones de
 * acción de las fichas.
 */
const GloboPresencia = () => {
  const theme = useTheme()
  const esPantallaChica = useMediaQuery(theme.breakpoints.down('md'))
  const { isAuthenticated } = useAuth()
  const autenticado = isAuthenticated()
  const { usuarios, totalEnLinea, loading } = usePresencia(autenticado && !esPantallaChica)
  const [ancla, setAncla] = useState<HTMLElement | null>(null)

  if (esPantallaChica || !autenticado) return null

  const conectados = usuarios.filter(u => u.estado === 'en_linea')
  const ausentes = usuarios.filter(u => u.estado === 'ausente')
  const desconectados = usuarios.filter(u => u.estado === 'desconectado')

  return (
    <>
      <Tooltip title={`${totalEnLinea} ${totalEnLinea === 1 ? 'persona conectada' : 'personas conectadas'}`}>
        <Fab
          color="primary"
          size="medium"
          onClick={(e) => setAncla(e.currentTarget)}
          sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: (t) => t.zIndex.drawer + 2 }}
          aria-label="Ver quién está conectado"
        >
          <Badge badgeContent={totalEnLinea} color="success" overlap="circular">
            <PeopleIcon />
          </Badge>
        </Fab>
      </Tooltip>

      <Popover
        open={Boolean(ancla)}
        anchorEl={ancla}
        onClose={() => setAncla(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 320, maxHeight: 460, borderRadius: 2 } } }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={700}>Quién está conectado</Typography>
          <Typography variant="caption" color="text.secondary">
            {totalEnLinea} en línea de {usuarios.length + 1} funcionarios
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={22} /></Box>
        ) : (
          <Box sx={{ overflowY: 'auto', maxHeight: 380 }}>
            {conectados.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No hay nadie más conectado en este momento.
                </Typography>
              </Box>
            )}

            {conectados.length > 0 && (
              <List dense disablePadding>
                {conectados.map(u => <Fila key={u.id} u={u} />)}
              </List>
            )}

            {ausentes.length > 0 && (
              <>
                <Divider />
                <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                  Ausentes ({ausentes.length})
                </Typography>
                <List dense disablePadding>
                  {ausentes.map(u => <Fila key={u.id} u={u} />)}
                </List>
              </>
            )}

            {desconectados.length > 0 && (
              <>
                <Divider />
                <Typography variant="caption" sx={{ px: 2, pt: 1, pb: 0.5, display: 'block', color: 'text.secondary', fontWeight: 600 }}>
                  Desconectados ({desconectados.length})
                </Typography>
                <List dense disablePadding>
                  {desconectados.map(u => <Fila key={u.id} u={u} />)}
                </List>
              </>
            )}
          </Box>
        )}

        <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            "En línea" significa que la persona tiene la plataforma abierta.
          </Typography>
        </Box>
      </Popover>
    </>
  )
}

export default GloboPresencia
