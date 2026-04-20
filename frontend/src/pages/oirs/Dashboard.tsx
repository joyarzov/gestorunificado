import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Stack,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress,
} from '@mui/material'
import {
  Forum as OirsIcon,
  AssignmentInd as AssignmentIcon,
  HourglassEmpty as HourglassIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  ArrowForward as ArrowForwardIcon,
  List as ListIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material'
import { oirsAPI } from '../../api/oirs'
import { OirsSolicitud } from '../../types'

interface Stats {
  total: number
  pendientes: number
  en_proceso: number
  respondidas: number
  por_tipo: Record<string, number>
  por_categoria: Record<string, number>
}

const estadoLabel: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'info' | 'error' }> = {
  recibido: { label: 'Recibido', color: 'info' },
  asignada: { label: 'Asignada', color: 'primary' },
  pendiente: { label: 'Pendiente', color: 'warning' },
  en_analisis: { label: 'En análisis', color: 'primary' },
  derivado: { label: 'Derivada', color: 'info' },
  respondido: { label: 'Respondida', color: 'success' },
  cerrado: { label: 'Cerrada', color: 'default' },
}

const tipoLabel: Record<string, string> = {
  consulta: 'Consulta',
  reclamo: 'Reclamo',
  sugerencia: 'Sugerencia',
  felicitacion: 'Felicitación',
  solicitud_informacion: 'Solicitud información',
}

const OirsDashboard = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [asignadas, setAsignadas] = useState<OirsSolicitud[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [estRes, asigRes] = await Promise.all([
          oirsAPI.estadisticas(),
          oirsAPI.misAsignadas({ page: 1, per_page: 5 }),
        ])
        setStats(estRes.data)
        setAsignadas(asigRes.data?.data ?? [])
      } catch (err) {
        console.error('Error cargando dashboard OIRS', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const proximasVencer = asignadas.filter((s) => {
    if (!s.fecha_limite_respuesta) return false
    if (s.estado === 'respondido' || s.estado === 'cerrado') return false
    const limite = new Date(s.fecha_limite_respuesta).getTime()
    const ahora = Date.now()
    const diasRestantes = (limite - ahora) / (1000 * 60 * 60 * 24)
    return diasRestantes <= 2
  }).length

  const kpis = [
    {
      label: 'Total',
      value: stats?.total ?? 0,
      icon: <OirsIcon />,
      color: '#EE5825',
    },
    {
      label: 'Pendientes',
      value: stats?.pendientes ?? 0,
      icon: <HourglassIcon />,
      color: '#EE5825',
    },
    {
      label: 'En proceso',
      value: stats?.en_proceso ?? 0,
      icon: <AssignmentIcon />,
      color: '#0071BC',
    },
    {
      label: 'Respondidas',
      value: stats?.respondidas ?? 0,
      icon: <CheckIcon />,
      color: '#8AC53E',
    },
  ]

  const tipos = stats?.por_tipo ? Object.entries(stats.por_tipo) : []
  const totalTipos = tipos.reduce((acc, [, v]) => acc + v, 0)

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            OIRS
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Oficina de Informaciones, Reclamos y Sugerencias
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="outlined" startIcon={<AssignmentIcon />} onClick={() => navigate('/oirs-admin/asignadas')}>
            Mis asignadas
          </Button>
          <Button variant="contained" startIcon={<ListIcon />} onClick={() => navigate('/oirs-admin/listar')}>
            Ver todas
          </Button>
        </Stack>
      </Box>

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map((kpi) => (
          <Grid item xs={6} sm={3} key={kpi.label}>
            <Paper
              sx={{
                p: 2,
                borderLeft: `4px solid ${kpi.color}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                height: '100%',
              }}
              elevation={1}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  bgcolor: `${kpi.color}1A`,
                  color: kpi.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {kpi.icon}
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600 }}>
                  {kpi.label}
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  {loading ? '—' : kpi.value}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {proximasVencer > 0 && (
        <Paper sx={{ p: 2, mb: 3, borderLeft: '4px solid #EE5825', display: 'flex', alignItems: 'center', gap: 1.5 }} elevation={0}>
          <WarningIcon sx={{ color: '#EE5825' }} />
          <Typography variant="body2">
            <strong>{proximasVencer}</strong> solicitud{proximasVencer === 1 ? '' : 'es'} asignada{proximasVencer === 1 ? '' : 's'} a ti
            {proximasVencer === 1 ? ' está' : ' están'} por vencer en las próximas 48 horas.
          </Typography>
        </Paper>
      )}

      <Grid container spacing={2}>
        {/* Mis asignadas */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ height: '100%' }} elevation={1}>
            <Box
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle1" fontWeight={700}>
                Mis solicitudes asignadas
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/oirs-admin/asignadas')}
              >
                Ver todas
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : asignadas.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No tienes solicitudes asignadas actualmente.
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {asignadas.map((s, idx) => {
                  const est = estadoLabel[s.estado] ?? { label: s.estado, color: 'default' as const }
                  return (
                    <Box key={s.id}>
                      {idx > 0 && <Divider component="li" />}
                      <ListItem
                        button
                        onClick={() => navigate(`/oirs-admin/${s.id}`)}
                        sx={{ py: 1.5 }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <OirsIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                              <Typography variant="body2" fontWeight={600}>
                                {s.folio} — {s.asunto}
                              </Typography>
                              <Chip size="small" label={tipoLabel[s.tipo_solicitud] ?? s.tipo_solicitud} variant="outlined" />
                              <Chip size="small" label={est.label} color={est.color} variant="outlined" />
                            </Stack>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {s.nombre_solicitante}
                              {s.fecha_limite_respuesta ? ` · Plazo: ${s.fecha_limite_respuesta}` : ''}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </Box>
                  )
                })}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Distribución por tipo */}
        <Grid item xs={12} md={4}>
          <Paper elevation={1} sx={{ height: '100%' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <BarChartIcon color="action" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>
                Distribución por tipo
              </Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              {tipos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin datos todavía.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {tipos.map(([tipo, cantidad]) => {
                    const pct = totalTipos > 0 ? (cantidad / totalTipos) * 100 : 0
                    return (
                      <Box key={tipo}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={600}>
                            {tipoLabel[tipo] ?? tipo}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {cantidad}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover' }}
                        />
                      </Box>
                    )
                  })}
                </Stack>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}

export default OirsDashboard
