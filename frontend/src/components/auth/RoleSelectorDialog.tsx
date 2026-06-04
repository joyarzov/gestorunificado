import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  Chip,
} from '@mui/material'
import {
  AdminPanelSettings as AdminIcon,
  Badge as OficialIcon,
  Person as UsuarioIcon,
  AccountBalance as AlcaldeIcon,
  Storefront as FomentoIcon,
  SupervisorAccount as SubroganciaIcon,
} from '@mui/icons-material'
import { useAuth } from '../../contexts/AuthContext'
import { SubrogadoActivo } from '../../types'

const roleConfig: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  admin: {
    label: 'Administrador',
    icon: <AdminIcon color="primary" />,
    description: 'Acceso completo al sistema',
  },
  alcalde: {
    label: 'Alcalde',
    icon: <AlcaldeIcon color="primary" />,
    description: 'Recepción y derivación de correspondencia',
  },
  oficial: {
    label: 'Oficial de Partes',
    icon: <OficialIcon color="secondary" />,
    description: 'Gestión de correspondencia y derivaciones',
  },
  usuario: {
    label: 'Usuario',
    icon: <UsuarioIcon color="action" />,
    description: 'Acceso a bandeja de entrada',
  },
  fomento_productivo: {
    label: 'Fomento Productivo',
    icon: <FomentoIcon color="secondary" />,
    description: 'Gestión de fondos concursables',
  },
}

// Jerarquía para elegir el "rol principal" que se mostrará al actuar como subrogado.
const PRIORIDAD_ROLES = ['alcalde', 'admin', 'oficial', 'oirs', 'fomento_productivo', 'usuario']

const rolPrincipal = (roles: string[]): string => {
  for (const r of PRIORIDAD_ROLES) {
    if (roles.includes(r)) return r
  }
  return roles[0] || 'usuario'
}

const RoleSelectorDialog = () => {
  const { user, showRoleSelector, selectRole, actuarComo, selectedRole, setShowRoleSelector } = useAuth()

  if (!user || !showRoleSelector) return null

  const subrogadosActivos: SubrogadoActivo[] = user.subrogados_activos ?? []
  // Solo se puede cancelar si ya hay un perfil activo (cambio de perfil).
  // En la selección obligatoria post-login (sin perfil aún) no se permite cerrar.
  const puedeCancelar = !!selectedRole

  return (
    <Dialog
      open={showRoleSelector}
      maxWidth="xs"
      fullWidth
      onClose={() => { if (puedeCancelar) setShowRoleSelector(false) }}
    >
      <DialogTitle>
        <Typography variant="h6" fontWeight="bold" textAlign="center">
          Selecciona tu perfil
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {user.nombre}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Tienes acceso a múltiples perfiles. Selecciona con cuál deseas ingresar.
          </Typography>
        </Box>
        <List>
          {user.roles?.map((role) => {
            const config = roleConfig[role] || {
              label: role,
              icon: <UsuarioIcon />,
              description: '',
            }
            return (
              <ListItem key={role} disablePadding>
                <ListItemButton
                  onClick={() => selectRole(role)}
                  sx={{
                    borderRadius: 2,
                    mb: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      borderColor: 'primary.main',
                      '& .MuiListItemText-primary': {
                        color: 'white',
                      },
                      '& .MuiListItemText-secondary': {
                        color: 'rgba(255,255,255,0.8)',
                      },
                    },
                  }}
                >
                  <ListItemIcon>{config.icon}</ListItemIcon>
                  <ListItemText primary={config.label} secondary={config.description} />
                </ListItemButton>
              </ListItem>
            )
          })}

          {subrogadosActivos.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }}>
                <Chip label="Subrogancias activas" size="small" color="warning" variant="outlined" />
              </Divider>
              {subrogadosActivos.map((s) => {
                const rol = rolPrincipal(s.roles)
                const cfg = roleConfig[rol] || { label: rol, icon: <SubroganciaIcon />, description: '' }
                return (
                  <ListItem key={`sub-${s.id}`} disablePadding>
                    <ListItemButton
                      onClick={() => actuarComo(s, rol)}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        border: '1px solid',
                        borderColor: 'warning.light',
                        backgroundColor: 'warning.50',
                        '&:hover': {
                          backgroundColor: 'warning.light',
                          borderColor: 'warning.main',
                        },
                      }}
                    >
                      <ListItemIcon>
                        <SubroganciaIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Actuar como ${s.nombre}`}
                        secondary={`${cfg.label}${s.cargo ? ` · ${s.cargo}` : ''} — Subrogancia activa`}
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </>
          )}
        </List>
      </DialogContent>
      {puedeCancelar && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowRoleSelector(false)} color="inherit">
            Cancelar
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}

export default RoleSelectorDialog
