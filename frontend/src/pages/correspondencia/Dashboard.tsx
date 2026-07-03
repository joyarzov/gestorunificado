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
} from '@mui/material'
import {
  Mail as MailIcon,
  Inbox as InboxIcon,
  HourglassEmpty as HourglassIcon,
  CheckCircle as CheckIcon,
  Archive as ArchiveIcon,
  Add as AddIcon,
  Search as SearchIcon,
  ArrowForward as ArrowForwardIcon,
  TrendingUp as TrendingUpIcon,
  Send as SendIcon,
  MarkEmailUnread as UnreadIcon,
  WarningAmber as WarningIcon,
  PriorityHigh as PriorityIcon,
} from '@mui/icons-material'
import { correspondenciaAPI, PanelAlcalde } from '../../api/correspondencia'
import { useAuth } from '../../contexts/AuthContext'
import { Correspondencia } from '../../types'
import { estadoCorrespondencia } from '../../utils/estadoCorrespondencia'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Stats {
  total: number
  pendientes: number
  en_proceso: number
  archivadas: number
}

const CorrespondenciaDashboard = () => {
  const navigate = useNavigate()
  const { isOficial, isAdmin, isAlcalde } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recientes, setRecientes] = useState<Correspondencia[]>([])
  const [panel, setPanel] = useState<PanelAlcalde | null>(null)
  const [loading, setLoading] = useState(true)

  const puedeIngresar = isOficial() || isAdmin()
  const esAlcalde = isAlcalde()

  useEffect(() => {
    const load = async () => {
      try {
        const [estRes, listRes] = await Promise.all([
          correspondenciaAPI.estadisticas(),
          correspondenciaAPI.listar({ page: 1, per_page: 5 }),
        ])
        setStats(estRes.data)
        setRecientes(listRes.data?.data ?? [])
        // Panel enriquecido solo para el alcalde.
        if (esAlcalde) {
          try {
            setPanel((await correspondenciaAPI.panelAlcalde()).data)
          } catch (e) {
            console.error('No se pudo cargar el panel del alcalde:', e)
          }
        }
      } catch (err) {
        console.error('Error cargando dashboard de correspondencia', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAlcalde])

  // Para el alcalde, KPIs orientados a su acción; para el resto, los genéricos.
  const kpis = panel
    ? [
        { label: 'Por derivar', value: panel.kpis.por_derivar, icon: <SendIcon />, color: '#EE5825' },
        { label: 'En gestión', value: panel.kpis.en_gestion, icon: <TrendingUpIcon />, color: '#0071BC' },
        { label: 'Esperando acuse', value: panel.kpis.esperando_acuse, icon: <UnreadIcon />, color: '#EB1B78' },
        { label: 'Por cerrar', value: panel.kpis.por_cerrar, icon: <CheckIcon />, color: '#8AC53E' },
      ]
    : [
        { label: 'Total', value: stats?.total ?? 0, icon: <MailIcon />, color: '#28A9E3' },
        { label: 'Pendientes', value: stats?.pendientes ?? 0, icon: <HourglassIcon />, color: '#EE5825' },
        { label: 'En proceso', value: stats?.en_proceso ?? 0, icon: <TrendingUpIcon />, color: '#0071BC' },
        { label: 'Completadas', value: stats?.archivadas ?? 0, icon: <ArchiveIcon />, color: '#8AC53E' },
      ]

  return (
    <Box>
      {/* Encabezado */}
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
            Correspondencia
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Recepción, derivación y seguimiento de correspondencia municipal
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<InboxIcon />}
            onClick={() => navigate('/bandeja')}
          >
            Ir a bandeja
          </Button>
          {puedeIngresar && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/ingresar')}
            >
              Ingresar correspondencia
            </Button>
          )}
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

      {/* Panel del alcalde: atención / salud / atrasos */}
      {panel && (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={7}>
              <Paper elevation={1} sx={{ height: '100%' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight={700}>Requiere tu atención</Typography>
                </Box>
                {panel.requiere_atencion.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Nada pendiente por ahora.</Typography>
                  </Box>
                ) : (
                  <List disablePadding>
                    {panel.requiere_atencion.map((r, i) => (
                      <Box key={r.id}>
                        {i > 0 && <Divider component="li" />}
                        <ListItem button onClick={() => navigate(`/correspondencia/${r.id}`)}>
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            {r.motivo === 'En tu despacho'
                              ? <SendIcon color="warning" />
                              : <UnreadIcon color="info" />}
                          </ListItemIcon>
                          <ListItemText
                            primary={<Typography variant="body2" fontWeight={600}>{r.folio || `#${r.id}`} — {r.remitente}</Typography>}
                            secondary={r.motivo}
                          />
                        </ListItem>
                      </Box>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper elevation={1} sx={{ height: '100%' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight={700}>Salud de la gestión</Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                  {([
                    { label: 'Derivadas a funcionarios', value: panel.salud.derivadas, color: undefined },
                    { label: 'Con acuse de todos', value: panel.salud.acuse_completo, color: 'success.main' },
                    { label: 'Acuse parcial', value: panel.salud.acuse_parcial, color: 'warning.main' },
                    { label: 'Sin ningún acuse', value: panel.salud.sin_acuse, color: 'error.main' },
                    { label: 'Con respuesta en el hilo', value: panel.salud.respondieron, color: 'info.main' },
                  ] as const).map((row) => (
                    <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.6 }}>
                      <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: row.color }}>{row.value}</Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          <Paper elevation={1} sx={{ mb: 2 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>Atrasos · sin acuse hace 3+ días</Typography>
            </Box>
            {panel.atrasos.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">Sin atrasos. La gestión está al día.</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {panel.atrasos.map((a, i) => (
                  <Box key={`${a.id}-${i}`}>
                    {i > 0 && <Divider component="li" />}
                    <ListItem button onClick={() => navigate(`/correspondencia/${a.id}`)}
                      secondaryAction={<Chip size="small" label={`${a.dias} d`} color={a.nivel === 'rojo' ? 'error' : 'warning'} />}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <PriorityIcon color={a.nivel === 'rojo' ? 'error' : 'warning'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{a.folio || `#${a.id}`} — {a.remitente}</Typography>}
                        secondary={`${a.dias} días sin acuse${a.destinatario ? ` · ${a.destinatario}` : ''}`}
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </>
      )}

      {!panel && (
      <Grid container spacing={2}>
        {/* Correspondencias recientes */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ height: '100%' }} elevation={1}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Correspondencia reciente
              </Typography>
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/correspondencia/listar')}>
                Ver todas
              </Button>
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : recientes.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No hay correspondencia registrada aún.
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {recientes.map((c, idx) => {
                  const est = estadoCorrespondencia(c.estado)
                  return (
                    <Box key={c.id}>
                      {idx > 0 && <Divider component="li" />}
                      <ListItem
                        button
                        onClick={() => navigate(`/correspondencia/${c.id}`)}
                        sx={{ py: 1.5 }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <MailIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                              <Typography variant="body2" fontWeight={600}>
                                {c.folio || c.numero_documento || `#${c.id}`} — {c.remitente}
                              </Typography>
                              <Chip size="small" label={est.label} color={est.color} variant="outlined" />
                            </Stack>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              Recibida: {c.fecha_recibo ? format(new Date(c.fecha_recibo), 'dd/MM/yyyy', { locale: es }) : '—'}
                              {c.departamento?.nombre ? ` · ${c.departamento.nombre}` : ''}
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

        {/* Acciones rápidas */}
        <Grid item xs={12} md={4}>
          <Paper elevation={1}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Acciones rápidas
              </Typography>
            </Box>
            <List disablePadding>
              <ListItem button onClick={() => navigate('/bandeja')}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <InboxIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Bandeja de entrada"
                  secondary="Revisa lo que llegó a tu unidad"
                />
              </ListItem>
              <Divider component="li" />
              <ListItem button onClick={() => navigate('/buscar')}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <SearchIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Búsqueda avanzada"
                  secondary="Busca por número, remitente o fecha"
                />
              </ListItem>
              {puedeIngresar && (
                <>
                  <Divider component="li" />
                  <ListItem button onClick={() => navigate('/ingresar')}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <AddIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Ingresar correspondencia"
                      secondary="Solo Oficina de Partes"
                    />
                  </ListItem>
                </>
              )}
              <Divider component="li" />
              <ListItem button onClick={() => navigate('/correspondencia/listar')}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <CheckIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Todas las correspondencias"
                  secondary="Listado completo con filtros"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
      )}
    </Box>
  )
}

export default CorrespondenciaDashboard
