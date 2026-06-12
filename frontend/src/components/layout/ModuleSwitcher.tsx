import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  IconButton,
  Popover,
  Box,
  Typography,
  Tooltip,
  Divider,
} from '@mui/material'
import {
  Apps as AppsIcon,
  Home as HomeIcon,
} from '@mui/icons-material'
import { useAuth } from '../../contexts/AuthContext'
import { MODULES, getModuleByPath, isModuloDeshabilitado } from '../../config/modules'

const ModuleSwitcher = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { hasAplicacion, isAdmin } = useAuth()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => setAnchorEl(null)

  const modulosVisibles = MODULES.filter((m) => {
    if (m.id === 'perfil') return false // el perfil no es un módulo de trabajo
    if (m.id === 'administracion') return isAdmin()
    return hasAplicacion(m.id)
  })

  const moduloActual = getModuleByPath(location.pathname)

  const handleNavigate = (path: string) => {
    handleClose()
    navigate(path)
  }

  const open = Boolean(anchorEl)

  return (
    <>
      <Tooltip title="Cambiar módulo">
        <IconButton
          onClick={handleOpen}
          sx={{
            color: '#0071BC',
            border: '1px solid',
            borderColor: open ? '#0071BC' : 'rgba(0, 113, 188, 0.2)',
            borderRadius: 2,
            p: 1,
            bgcolor: open ? 'rgba(0, 113, 188, 0.08)' : 'transparent',
            '&:hover': { bgcolor: 'rgba(0, 113, 188, 0.08)' },
          }}
          aria-label="Abrir selector de módulos"
        >
          <AppsIcon />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              p: 2,
              width: 340,
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(15, 23, 42, 0.18)',
            },
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: 'text.secondary',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            mb: 1.5,
            fontSize: 11,
          }}
        >
          Módulos disponibles
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
          }}
        >
          {modulosVisibles.map((mod) => {
            const Icon = mod.icono
            const activo = moduloActual?.id === mod.id
            const deshabilitado = isModuloDeshabilitado(mod.id)
            return (
              <Box
                key={mod.id}
                title={deshabilitado ? 'Temporalmente deshabilitado' : undefined}
                onClick={() => { if (!deshabilitado) handleNavigate(mod.rootPath) }}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.75,
                  p: 1.5,
                  borderRadius: 2,
                  cursor: deshabilitado ? 'not-allowed' : 'pointer',
                  opacity: deshabilitado ? 0.45 : 1,
                  border: '1px solid',
                  borderColor: activo ? mod.color : 'transparent',
                  bgcolor: activo ? `${mod.color}12` : 'transparent',
                  transition: 'background-color 0.15s, border-color 0.15s',
                  '&:hover': {
                    bgcolor: deshabilitado ? 'transparent' : `${mod.color}14`,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    bgcolor: `${mod.color}1A`,
                    color: mod.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon />
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    fontSize: 11.5,
                  }}
                >
                  {mod.nombre}
                </Typography>
              </Box>
            )
          })}
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Box
          onClick={() => handleNavigate('/portal')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            borderRadius: 1,
            cursor: 'pointer',
            color: 'text.secondary',
            '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
          }}
        >
          <HomeIcon fontSize="small" />
          <Typography variant="body2" fontWeight={500}>
            Volver al portal
          </Typography>
        </Box>
      </Popover>
    </>
  )
}

export default ModuleSwitcher
