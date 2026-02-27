import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
} from '@mui/material'
import {
  AdminPanelSettings as AdminIcon,
  Badge as OficialIcon,
  Person as UsuarioIcon,
  AccountBalance as AlcaldeIcon,
  Storefront as FomentoIcon,
} from '@mui/icons-material'
import { useAuth } from '../../contexts/AuthContext'

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

const RoleSelectorDialog = () => {
  const { user, showRoleSelector, selectRole, setShowRoleSelector } = useAuth()

  if (!user || !showRoleSelector) return null

  const handleSelectRole = (role: string) => {
    selectRole(role)
    setShowRoleSelector(false)
  }

  return (
    <Dialog open={showRoleSelector} maxWidth="xs" fullWidth>
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
                  onClick={() => handleSelectRole(role)}
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
        </List>
      </DialogContent>
    </Dialog>
  )
}

export default RoleSelectorDialog
