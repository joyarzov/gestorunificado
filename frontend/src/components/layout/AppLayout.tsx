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
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import {
  Menu as MenuIcon,
  ExitToApp as LogoutIcon,
  Person as PersonIcon,
  SwapHoriz as SwapRoleIcon,
  ChevronLeft as ChevronLeftIcon,
  Home as HomeIcon,
  SupervisorAccount as SubroganciaIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material'
import { useAuth } from '../../contexts/AuthContext'
import CorporateColorBar from '../branding/CorporateColorBar'
import NotificacionesBell from './NotificacionesBell'
import ModuleSwitcher from './ModuleSwitcher'
import { documentosAPI } from '../../api/gestor'
import { usersAPI } from '../../api/common'
import type { User as UserType } from '../../types'
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
    actuandoComo,
    salirDeActuandoComo,
    auditando,
    esModoAuditoria,
    auditarComo,
    salirAuditoria,
    logout,
    isAdmin,
    isOficial,
    isAlcalde,
    hasAplicacion,
    canViewAllCorrespondence,
    canViewRegistroCorrespondence,
    setShowRoleSelector,
  } = useAuth()
  const [pendientesFirmaCount, setPendientesFirmaCount] = useState(0)

  // Modo auditoría ("Ver como"): solo el admin. Diálogo con selector de funcionario.
  const [verComoOpen, setVerComoOpen] = useState(false)
  const [funcionarios, setFuncionarios] = useState<UserType[]>([])
  const [verComoSel, setVerComoSel] = useState<UserType | null>(null)
  const [verComoLoading, setVerComoLoading] = useState(false)

  const abrirVerComo = async () => {
    setVerComoSel(null)
    setVerComoOpen(true)
    if (funcionarios.length === 0) {
      try {
        const res = await usersAPI.funcionarios()
        setFuncionarios(res.data)
      } catch (err) {
        console.error('No se pudieron cargar los funcionarios:', err)
      }
    }
  }

  const confirmarVerComo = async () => {
    if (!verComoSel) return
    setVerComoLoading(true)
    try {
      await auditarComo(verComoSel.id)
      setVerComoOpen(false)
      navigate('/portal')
    } catch (err) {
      console.error('No se pudo iniciar el modo auditoría:', err)
    } finally {
      setVerComoLoading(false)
    }
  }

  // Al salir de auditoría, volver a una página válida para el admin.
  const handleSalirAuditoria = async () => {
    await salirAuditoria()
    navigate('/portal')
  }

  useEffect(() => {
    if (!hasAplicacion('gestor_documental')) return
    documentosAPI
      .pendientesFirma({ page: 1, per_page: 1 })
      .then((r) => setPendientesFirmaCount(r.data?.total ?? 0))
      .catch(() => {})
  }, [user])

  // Volver al tope al cambiar de página: sin esto, al entrar al detalle
  // se hereda el scroll del listado y el título/botones quedan fuera de vista.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

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
        canViewRegistroCorrespondence: canViewRegistroCorrespondence(),
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
          px: 2,
          minHeight: { xs: 56, sm: 64 }, // mismo alto que la AppBar (Toolbar)
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

          {/* Modo auditoría: solo el admin en su sesión normal (no dentro de auditoría) */}
          {isAdmin() && !esModoAuditoria && (
            <Tooltip title="Ver como funcionario (auditoría · solo lectura)">
              <IconButton color="inherit" onClick={abrirVerComo} sx={{ mr: 0.5 }}>
                <VisibilityIcon />
              </IconButton>
            </Tooltip>
          )}

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
            {(user?.roles?.length ?? 0) > 1 && (
              <MenuItem
                onClick={() => {
                  handleMenuClose()
                  setShowRoleSelector(true)
                }}
              >
                <ListItemIcon>
                  <SwapRoleIcon fontSize="small" />
                </ListItemIcon>
                Cambiar perfil
              </MenuItem>
            )}
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
        {actuandoComo && (
          <Alert
            severity="warning"
            icon={<SubroganciaIcon />}
            action={
              <Button color="inherit" size="small" onClick={salirDeActuandoComo}>
                Salir
              </Button>
            }
            sx={{ mb: 2, fontWeight: 500 }}
          >
            Estás actuando como <strong>{actuandoComo.nombre}</strong>
            {actuandoComo.cargo ? ` · ${actuandoComo.cargo}` : ''} — Subrogancia activa
          </Alert>
        )}
        {auditando && (
          <Alert
            severity="error"
            icon={<VisibilityIcon />}
            action={
              <Button color="inherit" size="small" onClick={handleSalirAuditoria}>
                Salir del modo auditoría
              </Button>
            }
            sx={{ mb: 2, fontWeight: 500 }}
          >
            Modo auditoría — viendo la plataforma como <strong>{auditando.nombre}</strong>
            {auditando.cargo ? ` · ${auditando.cargo}` : ''} (solo lectura)
          </Alert>
        )}
        <Outlet />
      </Box>

      {/* Selector "Ver como" (modo auditoría del admin) */}
      <Dialog open={verComoOpen} onClose={() => !verComoLoading && setVerComoOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Ver como funcionario</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Verás la plataforma tal como la ve el funcionario, en <strong>solo lectura</strong>.
            No podrás modificar datos mientras estés en modo auditoría.
          </Alert>
          <Autocomplete
            options={funcionarios}
            getOptionLabel={(u) => `${u.nombre}${u.cargo ? ' · ' + u.cargo : ''}`}
            value={verComoSel}
            onChange={(_, v) => setVerComoSel(v)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} label="Funcionario" placeholder="Buscar por nombre…" autoFocus />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerComoOpen(false)} disabled={verComoLoading}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={confirmarVerComo}
            disabled={verComoLoading || !verComoSel}
            startIcon={verComoLoading ? <CircularProgress size={16} /> : <VisibilityIcon />}
          >
            Ver como
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default AppLayout
