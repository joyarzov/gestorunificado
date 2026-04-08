import { useState, useEffect } from 'react'
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
  Badge,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Mail as MailIcon,
  Forum as OirsIcon,
  Description as GestorIcon,
  Settings as AdminIcon,
  Storefront as FomentoIcon,
  ExitToApp as LogoutIcon,
  Person as PersonIcon,
  ChevronLeft as ChevronLeftIcon,
  Create as FirmarIcon,
} from '@mui/icons-material'
import { useAuth } from '../../contexts/AuthContext'
import CorporateColorBar from '../branding/CorporateColorBar'
import NotificacionesBell from './NotificacionesBell'
import { documentosAPI } from '../../api/gestor'

const drawerWidth = 260

const AppLayout = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, selectedRole, logout, isAdmin, hasAplicacion } = useAuth()
  const [pendientesFirmaCount, setPendientesFirmaCount] = useState(0)

  useEffect(() => {
    if (!hasAplicacion('gestor_documental')) return
    documentosAPI.pendientesFirma({ page: 1, per_page: 1 })
      .then(r => setPendientesFirmaCount(r.data?.total ?? 0))
      .catch(() => {})
  }, [user])

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
      case 'fomento_productivo':
        return 'Fomento Productivo'
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
      text: selectedRole === 'admin' || selectedRole === 'oficial' ? 'Oficina de Partes' : 'Correspondencia',
      icon: <MailIcon />,
      path: selectedRole === 'usuario' || selectedRole === 'alcalde' ? '/bandeja' : '/correspondencia',
      show: hasAplicacion('correspondencia'),
    },
    {
      text: selectedRole === 'admin' || selectedRole === 'oirs' ? 'Admin OIRS' : 'Mis Solicitudes',
      icon: <OirsIcon />,
      path: selectedRole === 'admin' || selectedRole === 'oirs' ? '/oirs-admin' : '/mis-solicitudes',
      show: hasAplicacion('oirs'),
    },
    {
      text: 'Gestor Documental',
      icon: <GestorIcon />,
      path: '/gestor-documental',
      show: hasAplicacion('gestor_documental'),
    },
    {
      text: 'Pendientes de Firma',
      icon: (
        <Badge badgeContent={pendientesFirmaCount || 0} color="error" max={9}>
          <FirmarIcon />
        </Badge>
      ),
      path: '/pendientes-firma',
      show: hasAplicacion('gestor_documental'),
    },
    {
      text: 'Fomento Productivo',
      icon: <FomentoIcon />,
      path: '/fomento-productivo',
      show: hasAplicacion('fomento_productivo'),
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
            src="/logo_blanco.png"
            alt="Municipalidad de Cabo de Hornos"
            sx={{ height: 36, width: 'auto' }}
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
          <NotificacionesBell />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              ml: 1,
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
