import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Pagination,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  CheckCircle as RecibirIcon,
  Archive as ArchivarIcon,
} from '@mui/icons-material'
import { correspondenciaAPI } from '../../api/correspondencia'
import { Correspondencia, Derivacion } from '../../types'
import ResumenGestion from '../../components/correspondencia/ResumenGestion'
import EstrellaSeguimiento from '../../components/correspondencia/EstrellaSeguimiento'
import { estadoCorrespondencia } from '../../utils/estadoCorrespondencia'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'

/** Índice de la pestaña "En seguimiento" (las tres primeras son de derivaciones). */
const TAB_SEGUIMIENTO = 3

const BandejaEntrada = () => {
  const navigate = useNavigate()
  const { user, actuandoComo, isAlcalde } = useAuth()
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [counts, setCounts] = useState({ pendientes: 0, recibidas: 0, archivadas: 0 })
  // Pestaña "En seguimiento": lista CORRESPONDENCIAS (no derivaciones), porque
  // el Alcalde sigue el asunto completo, tenga o no una derivación dirigida a él.
  const [seguidas, setSeguidas] = useState<Correspondencia[]>([])
  const [totalSeguidas, setTotalSeguidas] = useState(0)

  useEffect(() => {
    loadBandeja()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actuandoComo?.id, tab, page])

  const loadBandeja = async () => {
    setLoading(true)
    setError('')
    try {
      if (tab === TAB_SEGUIMIENTO) {
        const response = await correspondenciaAPI.listaSeguimiento({ page, per_page: 30 })
        setSeguidas(response.data.items)
        setLastPage(response.data.last_page)
        setTotalSeguidas(response.data.total)
      } else {
        const response = await correspondenciaAPI.derivacionesPendientes({
          tab: tab === 0 ? 'pendientes' : tab === 1 ? 'recibidas' : 'archivadas',
          page,
          per_page: 30,
        })
        setDerivaciones(response.data.items)
        setLastPage(response.data.last_page)
        setCounts(response.data.counts)
      }
    } catch (err) {
      setError('Error al cargar la bandeja de entrada')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Al desmarcar desde la propia pestaña de seguimiento, la fila deja de
  // pertenecer a la lista: se saca en el acto en vez de recargar todo.
  const quitarDeLista = (id: number, sigue: boolean) => {
    if (sigue) return
    setSeguidas((prev) => prev.filter((c) => c.id !== id))
    setTotalSeguidas((prev) => Math.max(0, prev - 1))
  }

  const handleRecibir = async (id: number) => {
    try {
      await correspondenciaAPI.recibirDerivacion(id)
      loadBandeja()
    } catch (err) {
      console.error('Error al recibir:', err)
    }
  }

  const handleArchivar = async (id: number) => {
    try {
      await correspondenciaAPI.archivarDerivacion(id)
      loadBandeja()
    } catch (err) {
      console.error('Error al archivar:', err)
    }
  }

  // El filtrado por pestaña y la paginación (30 por página) los hace el backend.
  const filteredDerivaciones = derivaciones

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Bandeja de Entrada
        </Typography>
        <Button variant="contained" onClick={loadBandeja}>
          Actualizar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <Tabs
          value={tab}
          onChange={(_, newValue) => { setTab(newValue); setPage(1) }}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {/* "Activas" agrupa lo por recibir Y lo derivado en seguimiento;
              el estado puntual de cada ítem lo dice su chip. "Archivadas" reúne
              el archivo personal del funcionario (sus derivaciones archivadas)
              y los procesos cerrados por el Alcalde. */}
          <Tab label={`Activas (${counts.pendientes})`} />
          <Tab label={`Recibidas (${counts.recibidas})`} />
          <Tab label={`Archivadas (${counts.archivadas})`} />
          {/* Lista personal del usuario: lo que marcó con estrella para no
              perderle el hilo, ordenado por lo más tiempo sin movimiento. */}
          <Tab label={totalSeguidas > 0 ? `En seguimiento (${totalSeguidas})` : 'En seguimiento'} />
        </Tabs>

        {tab === TAB_SEGUIMIENTO ? (
          <TableContainer>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Folio</TableCell>
                  <TableCell>Remitente</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Último movimiento</TableCell>
                  <TableCell>Nota</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : seguidas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary" sx={{ mb: 0.5 }}>
                        No estás siguiendo ninguna correspondencia
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Marca la estrella ☆ en cualquier fila para no perderle el hilo.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  seguidas.map((c) => (
                    <TableRow
                      key={c.id}
                      hover
                      sx={c.tiene_novedades ? { bgcolor: 'action.hover', '& td': { fontWeight: 700 } } : undefined}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {c.tiene_novedades && (
                            <Box
                              component="span"
                              title="Tiene acciones nuevas sin leer"
                              sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }}
                            />
                          )}
                          <EstrellaSeguimiento
                            correspondenciaId={c.id}
                            seguida
                            onChange={(sigue) => quitarDeLista(c.id, sigue)}
                          />
                          <strong>{c.folio || `#${c.id}`}</strong>
                        </Box>
                      </TableCell>
                      <TableCell>{c.remitente || '-'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                          <Chip
                            label={estadoCorrespondencia(c.estado).label}
                            color={estadoCorrespondencia(c.estado).color}
                            size="small"
                          />
                          <ResumenGestion correspondencia={c} variant="lista" />
                        </Box>
                      </TableCell>
                      <TableCell>
                        {/* El dato que el acuse de recibo ocultaba: cuánto lleva quieta. */}
                        {c.dias_sin_movimiento === null || c.dias_sin_movimiento === undefined ? (
                          <Typography variant="body2" color="text.secondary">Sin registro</Typography>
                        ) : (
                          <Chip
                            label={
                              c.dias_sin_movimiento === 0
                                ? 'Hoy'
                                : `Hace ${c.dias_sin_movimiento} ${c.dias_sin_movimiento === 1 ? 'día' : 'días'}`
                            }
                            size="small"
                            color={c.estancada ? 'error' : 'default'}
                            variant={c.estancada ? 'filled' : 'outlined'}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 220 }}>
                          {c.nota_seguimiento || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/correspondencia/${c.id}`)}
                          title="Ver detalle"
                        >
                          <ViewIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Folio</TableCell>
                <TableCell>N° Documento</TableCell>
                <TableCell>Remitente</TableCell>
                <TableCell>Fecha Recibo</TableCell>
                <TableCell>Departamento</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredDerivaciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay correspondencia en esta bandeja
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDerivaciones.map((der) => (
                  <TableRow
                    key={der.id}
                    hover
                    sx={der.tiene_novedades ? { bgcolor: 'action.hover', '& td': { fontWeight: 700 } } : undefined}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {der.tiene_novedades && (
                          <Box
                            component="span"
                            title="Tiene acciones nuevas sin leer"
                            sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }}
                          />
                        )}
                        <EstrellaSeguimiento
                          correspondenciaId={der.correspondencia_id}
                          seguida={der.en_seguimiento}
                        />
                        <strong>{der.correspondencia?.folio || `#${der.correspondencia_id}`}</strong>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {der.correspondencia?.numero_documento || '-'}
                      </Typography>
                      {der.usuario_destino_id
                        && der.usuario_destino_id !== user?.id
                        && der.usuario_destino_id !== actuandoComo?.id && (
                        <Chip
                          label={`Para: ${der.usuario_destino?.nombre ?? 'subrogado'}`}
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{der.correspondencia?.remitente || '-'}</TableCell>
                    <TableCell>
                      {der.correspondencia?.fecha_recibo
                        ? format(new Date(der.correspondencia.fecha_recibo), 'dd/MM/yyyy', { locale: es })
                        : format(new Date(der.created_at), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>{der.departamento_origen?.nombre || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                        {tab === 2 ? (
                          <Chip label="Archivada" color="default" size="small" />
                        ) : (
                          <Chip
                            label={der.estado === 'pendiente' ? 'Por recibir' : der.estado === 'recibido' ? 'Recibida' : der.estado === 'derivado' ? 'Derivada a Funcionario' : der.estado}
                            color={der.estado === 'pendiente' ? 'warning' : der.estado === 'derivado' ? 'info' : 'success'}
                            size="small"
                          />
                        )}
                        {der.correspondencia && (
                          <ResumenGestion correspondencia={der.correspondencia} variant="lista" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/correspondencia/${der.correspondencia_id}`)}
                        title="Ver detalle"
                      >
                        <ViewIcon />
                      </IconButton>
                      {/* El alcalde NO acusa recibo desde la bandeja: debe abrir la
                          correspondencia (su acuse firma una providencia con FirmaGob/OTP,
                          que el ícono rápido no puede pedir). Ver detalle siempre disponible. */}
                      {tab !== 2 && der.estado === 'pendiente' && der.puede_actuar && !isAlcalde() && (
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleRecibir(der.id)}
                          title="Marcar como recibido"
                        >
                          <RecibirIcon />
                        </IconButton>
                      )}
                      {tab !== 2 && der.estado === 'recibido' && der.puede_actuar && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleArchivar(der.id)}
                          title="Archivar"
                        >
                          <ArchivarIcon />
                        </IconButton>
                      )}
                      {tab !== 2 && !der.puede_actuar && (der.estado === 'pendiente' || der.estado === 'recibido') && (
                        <Chip label="Solo lectura" size="small" variant="outlined" sx={{ ml: 0.5, height: 20, fontSize: 10 }} />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        )}
        {lastPage > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5, borderTop: '1px solid #eee' }}>
            <Pagination
              count={lastPage}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              size="small"
            />
          </Box>
        )}
      </Card>
    </Box>
  )
}

export default BandejaEntrada
