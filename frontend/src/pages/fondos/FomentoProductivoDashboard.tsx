import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Paper,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material'
import {
  Assignment as PostulacionIcon,
  TrendingUp as StatsIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material'
import { fondosConcursablesAPI } from '../../api/fondos'
import { FondoConcursable } from '../../types'

const FomentoProductivoDashboard = () => {
  const navigate = useNavigate()
  const [fondos, setFondos] = useState<FondoConcursable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fondosConcursablesAPI.listar()
        setFondos(res.data)
      } catch {
        setError('Error al cargar fondos concursables')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(monto)
  }

  const estadoColor: Record<string, 'success' | 'warning' | 'info' | 'default' | 'error'> = {
    borrador: 'default',
    abierto: 'success',
    cerrado: 'warning',
    evaluacion: 'info',
    finalizado: 'error',
  }

  const estadoLabel: Record<string, string> = {
    borrador: 'Borrador',
    abierto: 'Abierto',
    cerrado: 'Cerrado',
    evaluacion: 'En Evaluación',
    finalizado: 'Finalizado',
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Fomento Productivo
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Gestión de fondos concursables y evaluación de postulaciones.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Resumen rápido */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <StatsIcon sx={{ fontSize: 40, color: '#0071BC', mb: 1 }} />
            <Typography variant="h4" fontWeight="bold">{fondos.length}</Typography>
            <Typography variant="body2" color="text.secondary">Fondos Totales</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <PostulacionIcon sx={{ fontSize: 40, color: '#2DC700', mb: 1 }} />
            <Typography variant="h4" fontWeight="bold">
              {fondos.filter(f => f.estado === 'abierto').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Abiertos</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <CalendarIcon sx={{ fontSize: 40, color: '#EE5825', mb: 1 }} />
            <Typography variant="h4" fontWeight="bold">
              {fondos.reduce((sum, f) => sum + (f.postulaciones_count || 0), 0)}
            </Typography>
            <Typography variant="body2" color="text.secondary">Postulaciones</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <MoneyIcon sx={{ fontSize: 40, color: '#EB1B78', mb: 1 }} />
            <Typography variant="h4" fontWeight="bold">
              {formatMonto(fondos.reduce((sum, f) => sum + Number(f.monto_total), 0))}
            </Typography>
            <Typography variant="body2" color="text.secondary">Fondos Totales</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Lista de fondos */}
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Fondos Concursables
      </Typography>
      <Grid container spacing={3}>
        {fondos.map((fondo) => (
          <Grid item xs={12} sm={6} md={4} key={fondo.id}>
            <Card
              sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                borderTop: `4px solid ${estadoColor[fondo.estado] === 'success' ? '#2DC700' : estadoColor[fondo.estado] === 'warning' ? '#EE5825' : '#0071BC'}`,
              }}
            >
              <CardActionArea
                onClick={() => navigate(`/fondos-concursables/${fondo.id}`)}
                sx={{ height: '100%' }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {fondo.nombre}
                    </Typography>
                    <Chip
                      label={estadoLabel[fondo.estado] || fondo.estado}
                      color={estadoColor[fondo.estado] || 'default'}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {fondo.codigo} - {fondo.anio}
                  </Typography>
                  <Typography variant="body2">
                    Monto total: <strong>{formatMonto(fondo.monto_total)}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Postulaciones: <strong>{fondo.postulaciones_count || 0}</strong>
                  </Typography>
                  {fondo.fecha_cierre && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Cierre: {new Date(fondo.fecha_cierre).toLocaleDateString('es-CL')}
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
        {fondos.length === 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No hay fondos concursables creados</Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}

export default FomentoProductivoDashboard
