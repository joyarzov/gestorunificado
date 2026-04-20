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
  ExitToApp as LogoutIcon,
  Person as PersonIcon,
  ChevronLeft as ChevronLeftIcon,
  Home as HomeIcon,
} from '@mui/icons-material'
import { useAuth } from '../../contexts/AuthContext'
import CorporateColorBar from '../branding/CorporateColorBar'
import NotificacionesBell from './NotificacionesBell'
import ModuleSwitcher from './ModuleSwitcher'
import { documentosAPI } from '../../api/gestor'
import {
  MODULES,
  getModuleByPath,
  getSidebarItems,
  ModuleDefinition,
} from '../../config/modules'

const drawerWidth = 260

const AppLayout = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const {
    user,
    selectedRole,
    logout,
    isAdmin,
    isOficial,
    isAlcalde,
    hasAplicacion,
    canViewAllCorrespondence,
  } = useAuth()
  const [pendientesFirmaCount, setPendientesFirmaCount] = useState(0)

  useEffect(() => {
    if (!hasAplicacion('gestor_documental')) return
    documentosAPI
      .pendientesFirma({ page: 1, per_page: 1 })
      .then((r) => setPendientesFirmaCount(r.data?.total ?? 0))
      .catch(() => {})
  }, [user])

  const moduloActual: ModuleDefinition | null = getModuleByPath(location.pathname)

  const badges: Record<string, number> = {
    pendientes_firma: pendientesFirmaCount,
  }

  const sidebarItems = moduloActual
    ? getSidebarItems(moduloActual.id, {
        role: selectedRole,
        isAdmin: isAdmin(),
        isOficial: isOficial(),
        isAlcalde: isAlcalde(),
        canViewAllCorrespondence: canViewAllCorrespondence(),
      })
    : []

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen)
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
  const handleMenuClose = () => setAnchorEl(null)
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
      case 'oirs':
        return 'Administrador OIRS'
      case 'fomento_productivo':
        return 'Fomento Productivo'
      default:
        return 'Usuario'
    }
  }

  const ModuleIcon = moduloActual?.icono
  const moduloColor = moduloActual?.color ?? '#0071BC'

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header marca municipio */}
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
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              Cabo de Hornos
            </Typography>
          </Box>
        </Box>
        {isMobile && (
          <IconButton color="inherit" onClick={handleDrawerToggle}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>
      <CorporateColorBar height={4} />

      {/* Banner del módulo activo */}
      {moduloActual ? (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: 'background.default',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: `${moduloColor}1A`,
              color: moduloColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {ModuleIcon && <ModuleIcon fontSize="small" />}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                fontSize: 10.5,
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              Módulo
            </Typography>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                lineHeight: 1.25,
                fontSize: 14,
              }}
              noWrap
            >
              {moduloActual.nombre}
            </Typography>
          </Box>
        </Box>
      ) : null}

      <List sx={{ flexGrow: 1, pt: 1 }}>
        {sidebarItems.map((item) => {
          const Icon = item.icon
          const badgeCount = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0
          const exact = item.path === moduloActual?.rootPath
          const selected = exact
            ? location.pathname === item.path
            : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={selected}
                onClick={() => {
                  navigate(item.path)
                  if (isMobile) setMobileOpen(false)
                }}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  mb: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: moduloColor,
                    color: 'white',
                    '& .MuiListItemIcon-root': { color: 'white' },
                    '&:hover': { backgroundColor: moduloColor, opacity: 0.92 },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {badgeCount > 0 ? (
                    <Badge badgeContent={badgeCount} color="error" max={99}>
                      <Icon />
                    </Badge>
                  ) : (
                    <Icon />
                  )}
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </ListItem>
          )
        })}

        {/* Si no hay módulo detectado (ruta sin contexto), mostrar accesos a módulos */}
        {!moduloActual && (
          <>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => navigate('/portal')}
                sx={{ mx: 1, borderRadius: 2, mb: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HomeIcon />
                </ListItemIcon>
                <ListItemText primary="Portal" />
              </ListItemButton>
            </ListItem>
            {MODULES.filter((m) => (m.id === 'administracion' ? isAdmin() : hasAplicacion(m.id))).map(
              (m) => {
                const Icon = m.icono
                return (
                  <ListItem key={m.id} disablePadding>
                    <ListItemButton
                      onClick={() => navigate(m.rootPath)}
                      sx={{ mx: 1, borderRadius: 2, mb: 0.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40, color: m.color }}>
                        <Icon />
                      </ListItemIcon>
                      <ListItemText primary={m.nombre} />
                    </ListItemButton>
                  </ListItem>
                )
              }
            )}
          </>
        )}
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

          {/* Contexto del módulo en la topbar */}
          {moduloActual && (
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 24,
                  bgcolor: moduloColor,
                  borderRadius: 1,
                }}
              />
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'text.primary' }}>
                {moduloActual.nombre}
              </Typography>
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {/* Switcher 9-puntos */}
          <ModuleSwitcher />

          <NotificacionesBell />
          <Box
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', ml: 1 }}
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
              Mi perfil
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Cerrar sesión
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
