import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CircularProgress,
} from '@mui/material'
import {
  People as UsersIcon,
  Business as DeptosIcon,
  Settings as ConfigIcon,
  Archive as ArchiveIcon,
  Verified as SelloIcon,
  Description as PlantillaIcon,
} from '@mui/icons-material'
import { adminAPI, AdminDashboardStats } from '../../api/common'

// Tarjeta compacta de métrica.
const StatCard = ({
  valor, label, color = '#0071BC', onClick, destacado = false,
}: { valor: number; label: string; color?: string; onClick?: () => void; destacado?: boolean }) => (
  <Card
    variant="outlined"
    sx={{
      height: '100%',
      borderColor: destacado && valor > 0 ? color : '#e5e7eb',
      borderWidth: destacado && valor > 0 ? 2 : 1,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow 0.15s',
      '&:hover': onClick ? { boxShadow: 3 } : undefined,
    }}
    onClick={onClick}
  >
    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
      <Typography variant="h4" fontWeight="bold" sx={{ color, lineHeight: 1.1 }}>{valor}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block', mt: 0.5 }}>
        {label}
      </Typography>
    </CardContent>
  </Card>
)

const Administracion = () => {
  const navigate = useNavigate()

  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    adminAPI.dashboard()
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false))
  }, [])

  const modulos: {
    titulo: string
    descripcion: string
    icono: JSX.Element
    color: string
    ruta: string
    disabled?: boolean
  }[] = [
    {
      titulo: 'Usuarios',
      descripcion: 'Gestión de usuarios del sistema',
      icono: <UsersIcon sx={{ fontSize: 48 }} />,
      color: '#28A9E3',
      ruta: '/usuarios',
    },
    {
      titulo: 'Departamentos',
      descripcion: 'Administrar departamentos y unidades',
      icono: <DeptosIcon sx={{ fontSize: 48 }} />,
      color: '#8AC53E',
      ruta: '/departamentos',
    },
    {
      titulo: 'Configuración',
      descripcion: 'Configuración general del sistema',
      icono: <ConfigIcon sx={{ fontSize: 48 }} />,
      color: '#EE5825',
      ruta: '/configuracion',
    },
    {
      titulo: 'Repositorio Documental',
      descripcion: 'Archivo de documentos firmados',
      icono: <ArchiveIcon sx={{ fontSize: 48 }} />,
      color: '#0071BC',
      ruta: '/repositorio-documental',
    },
    {
      titulo: 'Sello de Firma',
      descripcion: 'Diseño del sello en documentos firmados electrónicamente',
      icono: <SelloIcon sx={{ fontSize: 48 }} />,
      color: '#EB1B78',
      ruta: '/firma-sellos',
    },
    {
      titulo: 'Plantillas de Documentos',
      descripcion: 'Mantenedor de plantillas del módulo cero papel',
      icono: <PlantillaIcon sx={{ fontSize: 48 }} />,
      color: '#2DC700',
      ruta: '/plantillas',
    },
  ]

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Administración del Sistema
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Gestión de usuarios, departamentos y configuración
      </Typography>

      {/* Indicadores */}
      {statsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
      ) : stats && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="overline" color="text.secondary">Usuarios</Typography>
          <Grid container spacing={2} sx={{ mb: 2, mt: 0 }}>
            <Grid item xs={6} sm={3}><StatCard valor={stats.usuarios.activos} label="Activos" color="#2DC700" onClick={() => navigate('/usuarios')} /></Grid>
            <Grid item xs={6} sm={3}><StatCard valor={stats.usuarios.sin_primer_ingreso} label="Sin primer ingreso" color="#EE5825" destacado onClick={() => navigate('/usuarios')} /></Grid>
            <Grid item xs={6} sm={3}><StatCard valor={stats.usuarios.clave_pendiente} label="Con clave temporal pendiente" color="#EB1B78" destacado onClick={() => navigate('/usuarios')} /></Grid>
            <Grid item xs={6} sm={3}><StatCard valor={stats.usuarios.inactivos} label="Deshabilitados" color="#94a3b8" onClick={() => navigate('/usuarios')} /></Grid>
          </Grid>

          <Typography variant="overline" color="text.secondary">Correspondencia</Typography>
          <Grid container spacing={2} sx={{ mb: 2, mt: 0 }}>
            <Grid item xs={6} sm={3}><StatCard valor={stats.correspondencia.entradas} label="Entradas" color="#0071BC" /></Grid>
            <Grid item xs={6} sm={3}><StatCard valor={stats.correspondencia.salidas} label="Salidas" color="#28A9E3" /></Grid>
            <Grid item xs={6} sm={3}><StatCard valor={stats.correspondencia.salidas_pendientes} label="Salidas por despachar" color="#EE5825" destacado /></Grid>
            <Grid item xs={6} sm={3}><StatCard valor={stats.correspondencia.archivadas} label="Completadas" color="#94a3b8" /></Grid>
          </Grid>

          <Typography variant="overline" color="text.secondary">Cero Papel y OIRS</Typography>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={6} sm={3}><StatCard valor={stats.documentos.firmado} label="Documentos firmados" color="#2DC700" /></Grid>
            <Grid item xs={6} sm={3}><StatCard valor={stats.documentos.pendiente_firma} label="Pendientes de firma" color="#EE5825" destacado /></Grid>
            <Grid item xs={6} sm={3}><StatCard valor={stats.expedientes} label="Expedientes" color="#8AC53E" /></Grid>
            <Grid item xs={6} sm={3}><StatCard valor={stats.oirs} label="Solicitudes OIRS" color="#EB1B78" /></Grid>
          </Grid>
        </Box>
      )}

      <Typography variant="overline" color="text.secondary">Accesos</Typography>
      <Grid container spacing={3} sx={{ mt: 0 }}>
        {modulos.map((modulo) => (
          <Grid item xs={12} sm={6} md={3} key={modulo.titulo}>
            <Card
              sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                opacity: modulo.disabled ? 0.6 : 1,
                '&:hover': {
                  transform: modulo.disabled ? 'none' : 'translateY(-4px)',
                  boxShadow: modulo.disabled ? 1 : 4,
                },
              }}
            >
              <CardActionArea
                onClick={() => !modulo.disabled && navigate(modulo.ruta)}
                disabled={modulo.disabled}
                sx={{ height: '100%' }}
              >
                <CardContent sx={{ textAlign: 'center', p: 4 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: 2,
                      bgcolor: `${modulo.color}20`,
                      mb: 2,
                      color: modulo.color,
                    }}
                  >
                    {modulo.icono}
                  </Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {modulo.titulo}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {modulo.descripcion}
                  </Typography>
                  {modulo.disabled && (
                    <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                      Próximamente
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

export default Administracion
