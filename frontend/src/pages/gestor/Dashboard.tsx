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
  Description as DocumentoIcon,
  Folder as ExpedienteIcon,
  PendingActions as PendienteIcon,
  Inbox as RecibidosIcon,
  CheckCircle as FirmadoIcon,
  Edit as BorradorIcon,
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material'
import { documentosAPI, expedientesAPI, documentoEnviosAPI } from '../../api/gestor'
import { Documento, DocumentoEnvio } from '../../types'

interface DocStats {
  total: number
  por_estado: Record<string, number>
  por_tipo: Record<string, number>
  creados_este_mes: number
}

interface ExpStats {
  total: number
  abiertos: number
  cerrados: number
  por_tipo: Record<string, number>
  por_departamento: Record<string, number>
  creados_este_mes: number
}

const estadoDocLabel: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'warning' | 'info' | 'error' }> = {
  borrador: { label: 'Borrador', color: 'default' },
  pendiente_firma: { label: 'Pendiente firma', color: 'warning' },
  firmado: { label: 'Firmado', color: 'success' },
  rechazado: { label: 'Rechazado', color: 'error' },
  anulado: { label: 'Anulado', color: 'default' },
  incorporado: { label: 'Incorporado', color: 'info' },
}

const GestorDashboard = () => {
  const navigate = useNavigate()
  const [docStats, setDocStats] = useState<DocStats | null>(null)
  const [expStats, setExpStats] = useState<ExpStats | null>(null)
  const [pendientesFirma, setPendientesFirma] = useState<Documento[]>([])
  const [pendientesFirmaTotal, setPendientesFirmaTotal] = useState(0)
  const [recibidos, setRecibidos] = useState<DocumentoEnvio[]>([])
  const [recibidosNoLeidos, setRecibidosNoLeidos] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [docStatsRes, expStatsRes, pendRes, recibRes] = await Promise.all([
          documentosAPI.estadisticas(),
          expedientesAPI.estadisticas(),
          documentosAPI.pendientesFirma({ page: 1, per_page: 5 }),
          documentoEnviosAPI.recibidos({ page: 1, per_page: 5 }),
        ])
        setDocStats(docStatsRes.data)
        setExpStats(expStatsRes.data)
        setPendientesFirma(pendRes.data?.data ?? [])
        setPendientesFirmaTotal(pendRes.data?.total ?? 0)
        setRecibidos(recibRes.data?.data ?? [])
        setRecibidosNoLeidos((recibRes.data?.data ?? []).filter((r) => r.estado === 'enviado').length)
      } catch (err) {
        console.error('Error cargando dashboard Cero Papel', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const kpis = [
    {
      label: 'Mis documentos',
      value: docStats?.total ?? 0,
      icon: <DocumentoIcon />,
      color: '#8AC53E',
      delta: docStats?.creados_este_mes ? `+${docStats.creados_este_mes} este mes` : undefined,
    },
    {
      label: 'Pendientes de firma',
      value: pendientesFirmaTotal,
      icon: <PendienteIcon />,
      color: '#EE5825',
      highlight: pendientesFirmaTotal > 0,
    },
    {
      label: 'Expedientes abiertos',
      value: expStats?.abiertos ?? 0,
      icon: <ExpedienteIcon />,
      color: '#28A9E3',
      delta: expStats ? `${expStats.cerrados} cerrados` : undefined,
    },
    {
      label: 'Recibidos sin leer',
      value: recibidosNoLeidos,
      icon: <RecibidosIcon />,
      color: '#0071BC',
      highlight: recibidosNoLeidos > 0,
    },
  ]

  const estadosDoc = docStats?.por_estado
    ? Object.entries(docStats.por_estado).filter(([, v]) => v > 0)
    : []
  const totalEstados = estadosDoc.reduce((acc, [, v]) => acc + v, 0)

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
            Cero Papel
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Documentos, expedientes y firma electrónica
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/expedientes/nuevo')}
          >
            Nuevo expediente
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/documentos/nuevo')}
          >
            Nuevo documento
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
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600 }}
                >
                  {kpi.label}
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  {loading ? '—' : kpi.value}
                </Typography>
                {kpi.delta && (
                  <Typography variant="caption" color="text.secondary">
                    {kpi.delta}
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Alerta si hay pendientes de firma */}
      {pendientesFirmaTotal > 0 && (
        <Paper
          sx={{
            p: 2,
            mb: 3,
            borderLeft: '4px solid #EE5825',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
          elevation={0}
        >
          <WarningIcon sx={{ color: '#EE5825' }} />
          <Typography variant="body2" sx={{ flex: 1 }}>
            Tienes <strong>{pendientesFirmaTotal}</strong> documento
            {pendientesFirmaTotal === 1 ? '' : 's'} esperando tu firma.
          </Typography>
          <Button size="small" variant="contained" color="warning" onClick={() => navigate('/pendientes-firma')}>
            Revisar
          </Button>
        </Paper>
      )}

      <Grid container spacing={2}>
        {/* Mis pendientes de firma */}
        <Grid item xs={12} md={7}>
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
              <Stack direction="row" alignItems="center" spacing={1}>
                <PendienteIcon fontSize="small" sx={{ color: '#EE5825' }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Pendientes de tu firma
                </Typography>
              </Stack>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/pendientes-firma')}
              >
                Ver todos
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : pendientesFirma.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <FirmadoIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No tienes documentos pendientes de firma. ¡Al día!
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {pendientesFirma.map((doc, idx) => {
                  const est = estadoDocLabel[doc.estado] ?? { label: doc.estado, color: 'default' as const }
                  return (
                    <Box key={doc.id}>
                      {idx > 0 && <Divider component="li" />}
                      <ListItem
                        button
                        onClick={() => navigate(`/documentos/${doc.id}`)}
                        sx={{ py: 1.5 }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <DocumentoIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                              <Typography variant="body2" fontWeight={600}>
                                {doc.identificador} — {doc.titulo}
                              </Typography>
                              <Chip size="small" label={est.label} color={est.color} variant="outlined" />
                            </Stack>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              {doc.tipo_documental?.nombre ?? 'Documento'}
                              {doc.creador?.nombre ? ` · Creado por ${doc.creador.nombre}` : ''}
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

        {/* Documentos recibidos */}
        <Grid item xs={12} md={5}>
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
              <Stack direction="row" alignItems="center" spacing={1}>
                <RecibidosIcon fontSize="small" color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  Últimos recibidos
                </Typography>
              </Stack>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/documentos-recibidos')}
              >
                Ver todos
              </Button>
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : recibidos.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No tienes documentos recibidos.
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {recibidos.map((env, idx) => (
                  <Box key={env.id}>
                    {idx > 0 && <Divider component="li" />}
                    <ListItem
                      button
                      onClick={() => env.documento && navigate(`/documentos/${env.documento.id}`)}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {env.estado === 'enviado' ? (
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              ml: 1,
                            }}
                          />
                        ) : (
                          <Box sx={{ width: 10, height: 10, ml: 1 }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={env.estado === 'enviado' ? 700 : 500}>
                            {env.documento?.titulo ?? `Envío #${env.id}`}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {env.remitente?.nombre ?? '—'} · {env.fecha_envio}
                          </Typography>
                        }
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Distribución por estado */}
        <Grid item xs={12} md={6}>
          <Paper elevation={1}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon color="action" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>
                Mis documentos por estado
              </Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              {estadosDoc.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aún no has creado documentos.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {estadosDoc.map(([estado, cantidad]) => {
                    const est = estadoDocLabel[estado] ?? { label: estado, color: 'default' as const }
                    const pct = totalEstados > 0 ? (cantidad / totalEstados) * 100 : 0
                    return (
                      <Box key={estado}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip size="small" label={est.label} color={est.color} variant="outlined" />
                          </Stack>
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

        {/* Accesos rápidos para crear */}
        <Grid item xs={12} md={6}>
          <Paper elevation={1}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Crear desde plantilla
              </Typography>
            </Box>
            <List disablePadding>
              <ListItem button onClick={() => navigate('/documentos/nuevo?tipo=DEC')}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <BorradorIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Decreto alcaldicio"
                  secondary="Con firma electrónica del Alcalde"
                />
              </ListItem>
              <Divider component="li" />
              <ListItem button onClick={() => navigate('/documentos/nuevo?tipo=RES')}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <BorradorIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Resolución exenta"
                  secondary="Con correlativo automático"
                />
              </ListItem>
              <Divider component="li" />
              <ListItem button onClick={() => navigate('/documentos/nuevo?tipo=OFI')}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <BorradorIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Oficio ordinario"
                  secondary="Comunicación externa"
                />
              </ListItem>
              <Divider component="li" />
              <ListItem button onClick={() => navigate('/documentos/nuevo?tipo=MEM')}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <BorradorIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Memorándum"
                  secondary="Comunicación interna"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}

export default GestorDashboard
