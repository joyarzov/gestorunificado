import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Mail as MailIcon,
  Forum as OirsIcon,
  Description as GestorIcon,
  Settings as AdminIcon,
  ExitToApp as LogoutIcon,
  Person as PersonIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material'
import { useAuth } from '../../contexts/AuthContext'
import CorporateColorBar from '../branding/CorporateColorBar'

const drawerWidth = 260

const AppLayout = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, selectedRole, logout, isAdmin, hasAplicacion } = useAuth()

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = async () => {
    handleMenuClose()
    await logout()
    navigate('/login')
  }

  const getRoleLabel = () => {
    switch (selectedRole) {
      case 'admin':
        return 'Administrador'
      case 'alcalde':
        return 'Alcalde'
      case 'oficial':
        return 'Oficial de Partes'
      default:
        return 'Usuario'
    }
  }

  const menuItems = [
    {
      text: 'Portal',
      icon: <HomeIcon />,
      path: '/portal',
      show: true,
    },
    {
      text: 'Correspondencia',
      icon: <MailIcon />,
      path: selectedRole === 'usuario' || selectedRole === 'alcalde' ? '/bandeja' : '/correspondencia',
      show: hasAplicacion('correspondencia'),
    },
    {
      text: selectedRole === 'admin' || selectedRole === 'oficial' ? 'Admin OIRS' : 'Mis Solicitudes',
      icon: <OirsIcon />,
      path: selectedRole === 'admin' || selectedRole === 'oficial' ? '/oirs-admin' : '/mis-solicitudes',
      show: hasAplicacion('oirs'),
    },
    {
      text: 'Gestor Documental',
      icon: <GestorIcon />,
      path: '/gestor-documental',
      show: hasAplicacion('gestor_documental'),
    },
    {
      text: 'Administración',
      icon: <AdminIcon />,
      path: '/administracion',
      show: isAdmin(),
    },
  ]

  const drawer = (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: '#0071BC',
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Municipalidad de Cabo de Hornos"
            sx={{ height: 40, width: 'auto', filter: 'brightness(0) invert(1)' }}
          />
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
              Municipalidad
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>Cabo de Hornos</Typography>
          </Box>
        </Box>
        {isMobile && (
          <IconButton color="inherit" onClick={handleDrawerToggle}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>
      <CorporateColorBar height={4} />
      <List>
        {menuItems
          .filter((item) => item.show)
          .map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname.startsWith(item.path)}
                onClick={() => {
                  navigate(item.path)
                  if (isMobile) setMobileOpen(false)
                }}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.light',
                    color: 'white',
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          background: 'white',
          color: 'text.primary',
          boxShadow: 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={handleMenuClick}
          >
            <Box sx={{ textAlign: 'right', mr: 1, display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" fontWeight="medium">
                {user?.nombre}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {getRoleLabel()}
              </Typography>
            </Box>
            <Avatar sx={{ bgcolor: 'primary.main' }}>{user?.nombre?.charAt(0) || 'U'}</Avatar>
          </Box>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem
              onClick={() => {
                handleMenuClose()
                navigate('/cambiar-password')
              }}
            >
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Cambiar Contraseña
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Cerrar Sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 3 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}

export default AppLayout
