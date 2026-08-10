import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  CircularProgress,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
} from '@mui/material'
import {
  CheckCircle as SuccessIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material'
import { departamentosAPI, usersAPI } from '../../api/common'
import { correspondenciaAPI, CreateDerivacionData } from '../../api/correspondencia'
import { Departamento, Derivacion, User } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import FirmaGobModal, { FirmaParams } from './FirmaGobModal'

const ACCIONES_PARA_OPTIONS = [
  'Tomar conocimiento',
  'Informar',
  'Tramitar',
  'Archivar',
  'Responder',
  'Coordinar',
  'Cumplir',
]

interface DerivacionDialogProps {
  open: boolean
  onClose: () => void
  correspondenciaId: number
  prefillDepartamentoId?: number
  prefillUsuarioId?: number
  readOnly?: boolean
  mode?: 'alcalde' | 'funcionario'
  /** Derivaciones ya existentes, para avisar a quién no hace falta volver a derivar. */
  derivacionesActuales?: Derivacion[]
  onSuccess: () => void
}

const DerivacionDialog = ({
  open,
  onClose,
  correspondenciaId,
  prefillDepartamentoId,
  prefillUsuarioId,
  readOnly = false,
  mode = 'alcalde',
  derivacionesActuales = [],
  onSuccess,
}: DerivacionDialogProps) => {
  const { checkAuth, user, actuandoComo } = useAuth()
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [selectedDepto, setSelectedDepto] = useState<Departamento | null>(null)
  const [selectedUsuario, setSelectedUsuario] = useState<User | null>(null)
  // Modo alcalde: destinos específicos (funcionarios y/o departamentos completos,
  // combinables en una misma derivación) o todos los funcionarios del municipio.
  const [tipoDestino, setTipoDestino] = useState<'especificos' | 'todos'>('especificos')
  const [selectedUsuarios, setSelectedUsuarios] = useState<User[]>([])
  const [selectedDeptos, setSelectedDeptos] = useState<Departamento[]>([])
  const [observaciones, setObservaciones] = useState('')
  const [accionesPara, setAccionesPara] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [showSuccess, setShowSuccess] = useState(false)
  const [providenciaCorrespondenciaId, setProvidenciaCorrespondenciaId] = useState<number | null>(null)

  // FirmaGob modal
  const [showFirmaModal, setShowFirmaModal] = useState(false)
  const [firmaLoading, setFirmaLoading] = useState(false)
  const [firmaError, setFirmaError] = useState<string | null>(null)
  const [pendingData, setPendingData] = useState<CreateDerivacionData | null>(null)
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const esModoFuncionario = mode === 'funcionario'

  useEffect(() => {
    if (open) {
      loadData()
      setShowSuccess(false)
      setProvidenciaCorrespondenciaId(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const loadData = async () => {
    setLoadingData(true)
    try {
      const [deptosRes, usersRes] = await Promise.all([
        departamentosAPI.listar(),
        usersAPI.funcionarios(),
      ])
      setDepartamentos(deptosRes.data)
      setUsuarios(usersRes.data)

      if (prefillDepartamentoId) {
        const depto = deptosRes.data.find((d: Departamento) => d.id === prefillDepartamentoId)
        if (depto) setSelectedDepto(depto)
      }
      if (prefillUsuarioId) {
        const user = usersRes.data.find((u: User) => u.id === prefillUsuarioId)
        if (user) setSelectedUsuario(user)
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoadingData(false)
    }
  }

  const handleToggleAccion = (accion: string) => {
    setAccionesPara((prev) =>
      prev.includes(accion)
        ? prev.filter((a) => a !== accion)
        : [...prev, accion]
    )
  }

  // Destino según modalidad. En modo alcalde el departamento ya no es
  // obligatorio: se puede derivar a funcionario(s), a departamento(s) completo(s),
  // a ambos a la vez, o a todos.
  const buildDestino = () => {
    if (!esModoFuncionario || readOnly) {
      return {
        departamento_destino_id: selectedDepto?.id,
        usuario_destino_id: selectedUsuario?.id,
      }
    }
    if (tipoDestino === 'todos') return { derivar_a_todos: true }
    return {
      usuario_destino_ids: selectedUsuarios.length > 0 ? selectedUsuarios.map((u) => u.id) : undefined,
      departamento_destino_ids: selectedDeptos.length > 0 ? selectedDeptos.map((d) => d.id) : undefined,
    }
  }

  const destinoValido = esModoFuncionario && !readOnly
    ? (tipoDestino === 'todos' || selectedUsuarios.length > 0 || selectedDeptos.length > 0)
    : !!selectedDepto

  const handleSubmit = async () => {
    if (!destinoValido) return

    const formData: CreateDerivacionData = {
      correspondencia_id: correspondenciaId,
      ...buildDestino(),
      observaciones: observaciones || undefined,
      acciones_para: esModoFuncionario && accionesPara.length > 0 ? accionesPara : undefined,
    }

    if (esModoFuncionario) {
      // Alcalde derivando → primero generar preview de la providencia y luego pedir OTP
      setPendingData(formData)
      setFirmaError(null)
      setPreviewLoading(true)
      try {
        const { blob, token } = await correspondenciaAPI.previewDerivar({
          correspondencia_id: correspondenciaId,
          ...buildDestino(),
          observaciones: observaciones || undefined,
          acciones_para: accionesPara.length > 0 ? accionesPara : undefined,
        })
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        setPreviewPdfUrl(url)
        setPreviewToken(token)
        setShowFirmaModal(true)
      } catch (err: any) {
        setFirmaError(err?.response?.data?.message || 'No se pudo generar la vista previa de la providencia.')
        setShowFirmaModal(true)
      } finally {
        setPreviewLoading(false)
      }
      return
    }

    // Modo no-alcalde: derivar directamente
    setLoading(true)
    try {
      await correspondenciaAPI.derivar(formData)
      onSuccess()
      handleClose()
    } catch (err) {
      console.error('Error al derivar:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFirmarYDerivar = async ({ otp, firmaY, firmaPage, firmaCol, desatendida, firmaRect }: FirmaParams) => {
    if (!pendingData) return
    setFirmaLoading(true)
    setFirmaError(null)
    try {
      await correspondenciaAPI.derivar({
        ...pendingData,
        otp: desatendida ? undefined : otp,
        firma_desatendida: desatendida,
        firma_y: firmaY,
        firma_page: firmaPage,
        firma_col: firmaCol,
        firma_x: firmaRect?.llx,
        firma_x2: firmaRect?.urx,
        firma_y2: firmaRect?.ury,
        firma_page_h: firmaRect?.pageH,
        preview_token: previewToken ?? undefined,
      })
      // Refrescar el user para preseleccionar el modo elegido en la próxima firma.
      checkAuth()
      setShowFirmaModal(false)
      revokePreview()
      setProvidenciaCorrespondenciaId(correspondenciaId)
      setShowSuccess(true)
    } catch (err: any) {
      setFirmaError(err?.response?.data?.message || 'Error al firmar. Verifique el código OTP e intente nuevamente.')
    } finally {
      setFirmaLoading(false)
    }
  }

  const revokePreview = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl)
    }
    setPreviewPdfUrl(null)
    setPreviewToken(null)
  }

  const handleClose = () => {
    revokePreview()
    setSelectedDepto(null)
    setSelectedUsuario(null)
    setSelectedUsuarios([])
    setSelectedDeptos([])
    setTipoDestino('especificos')
    setObservaciones('')
    setAccionesPara([])
    setShowSuccess(false)
    setProvidenciaCorrespondenciaId(null)
    setShowFirmaModal(false)
    setPendingData(null)
    setFirmaError(null)
    onClose()
  }

  const handleSuccessClose = () => {
    onSuccess()
    handleClose()
  }

  const handleVerProvidencia = async () => {
    if (!providenciaCorrespondenciaId) return
    try {
      const blob = await correspondenciaAPI.descargarProvidencia(providenciaCorrespondenciaId)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch (err) {
      console.error('Error al descargar providencia:', err)
    }
  }

  // El admin es una cuenta técnica adscrita al departamento Alcaldía; NO debe
  // aparecer como destinatario de una derivación. Institucionalmente la
  // correspondencia derivada a Alcaldía siempre es para el Alcalde, y ofrecer
  // al admin en el selector hace que se elija por error y se pierda de su
  // bandeja. Espeja el criterio operativo del backend (no es receptor).
  // Tampoco el propio actor (ni el titular cuando subroga): nadie se auto-deriva
  // — ya tiene la correspondencia y la auto-derivación queda pendiente y bloquea
  // el cierre. El backend además lo garantiza (resolverDestinatarios).
  const propiosIds = [user?.id, actuandoComo?.id].filter(Boolean)
  const usuariosSeleccionables = usuarios.filter(
    (u) => !(u.roles || []).includes('admin') && !propiosIds.includes(u.id)
  )

  const filteredUsuarios = selectedDepto
    ? usuariosSeleccionables.filter((u) => u.departamento_id === selectedDepto.id)
    : usuariosSeleccionables

  // Cuántos funcionarios recibirán la correspondencia con los destinos elegidos.
  // Quien está seleccionado en persona y además pertenece a un departamento
  // elegido cuenta una sola vez (el backend no lo notifica dos veces).
  const idsDeptosDestino = selectedDeptos.map((d) => d.id)
  const alcanceDestinos = new Set([
    ...selectedUsuarios.map((u) => u.id),
    ...usuariosSeleccionables
      .filter((u) => u.departamento_id != null && idsDeptosDestino.includes(u.departamento_id))
      .map((u) => u.id),
  ]).size

  // A quien se eligió en persona y además está en un departamento derivado
  // completo, el backend le deja SOLO la derivación del departamento (si no,
  // tendría que acusar recibo dos veces). Se avisa para que el alcalde sepa que
  // esa persona no queda con una derivación a su nombre.
  const usuariosAbsorbidos = selectedUsuarios.filter(
    (u) => u.departamento_id != null && idsDeptosDestino.includes(u.departamento_id)
  )
  const nominalesEfectivos = selectedUsuarios.length - usuariosAbsorbidos.length

  // Quién ya tiene la correspondencia (derivaciones vigentes; las de tránsito,
  // ya cursadas, no cuentan). Al derivar de nuevo el alcalde no recuerda a quién
  // mandó antes: elegir al mismo destino crea una segunda derivación y le exige
  // acusar recibo dos veces.
  const yaDerivados = derivacionesActuales
    .filter((d) => d.estado === 'pendiente' || d.estado === 'recibido')
    .map((d) => d.usuario_destino?.nombre || d.departamento_destino?.nombre)
    .filter((n): n is string => !!n)
    .filter((n, i, arr) => arr.indexOf(n) === i)

  // Desglose del alcance; solo aporta cuando hay departamentos de por medio
  // (con puros funcionarios el conteo ya lo dice todo).
  const detalleDestinos = selectedDeptos.length === 0
    ? ''
    : [
        nominalesEfectivos > 0 && `${nominalesEfectivos} en persona`,
        `${selectedDeptos.length} ${selectedDeptos.length === 1 ? 'departamento completo' : 'departamentos completos'}`,
      ].filter(Boolean).join(' + ')

  // Modal FirmaGob (mientras el formulario principal permanece abierto detrás)
  if (showFirmaModal) {
    return (
      <>
        {/* Mantener el Dialog del formulario montado pero tapado por FirmaGobModal */}
        <FirmaGobModal
          open={showFirmaModal}
          titulo="Firmar Providencia con FirmaGob"
          descripcion="La providencia será firmada electrónicamente antes de derivar la correspondencia. Seleccione la posición del sello e ingrese su código OTP."
          loading={firmaLoading || previewLoading}
          error={firmaError}
          pdfUrl={previewPdfUrl}
          onFirmar={handleFirmarYDerivar}
          onCancel={() => {
            setShowFirmaModal(false)
            setFirmaError(null)
            revokePreview()
          }}
        />
      </>
    )
  }

  // Success view after providencia generation
  if (showSuccess) {
    return (
      <Dialog open={open} onClose={handleSuccessClose} maxWidth="sm" fullWidth>
        <DialogTitle>Derivacion Completada</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <SuccessIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Providencia generada exitosamente
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              La correspondencia ha sido derivada y se ha generado la providencia PDF.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              startIcon={<PdfIcon />}
              onClick={handleVerProvidencia}
              sx={{ mb: 1 }}
            >
              Ver Providencia PDF
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleSuccessClose}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {readOnly ? 'Derivar a Alcalde' : 'Derivar a Funcionario'}
      </DialogTitle>
      <DialogContent>
        {loadingData ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {esModoFuncionario && !readOnly ? (
              <>
                {yaDerivados.length > 0 && (
                  <Alert severity="info">
                    Esta correspondencia ya está derivada a <strong>{yaDerivados.join(', ')}</strong>.
                    Elige solo a quien falte: volver a elegir el mismo destino crea una segunda
                    derivación y le exige acusar recibo de nuevo.
                  </Alert>
                )}

                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  color="primary"
                  value={tipoDestino}
                  onChange={(_, value) => {
                    if (!value) return
                    setTipoDestino(value)
                    setSelectedDepto(null)
                    setSelectedUsuarios([])
                    setSelectedDeptos([])
                  }}
                >
                  <ToggleButton value="especificos">Destinos específicos</ToggleButton>
                  <ToggleButton value="todos">Todos los funcionarios</ToggleButton>
                </ToggleButtonGroup>

                {tipoDestino === 'especificos' && (
                  /* Funcionarios y departamentos completos son destinos
                     independientes y combinables en una misma derivación
                     (ej: al Director de Obras y, además, a todo SECPLAN).
                     El buscador de funcionarios no se filtra por departamento:
                     se busca por nombre entre todos. */
                  <>
                    <Autocomplete
                      multiple
                      options={usuariosSeleccionables}
                      getOptionLabel={(opt) => `${opt.nombre} (${opt.rut})`}
                      value={selectedUsuarios}
                      onChange={(_, value) => setSelectedUsuarios(value)}
                      renderOption={(props, opt) => (
                        <Box component="li" {...props} key={opt.id}>
                          <Box>
                            <Typography variant="body2">{opt.nombre}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {[opt.cargo, departamentos.find((d) => d.id === opt.departamento_id)?.nombre]
                                .filter(Boolean)
                                .join(' · ') || opt.rut}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((opt, index) => (
                          <Chip
                            {...getTagProps({ index })}
                            key={opt.id}
                            label={opt.nombre}
                            size="small"
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Funcionario(s) destino"
                          helperText="Busca por nombre; puedes combinar funcionarios de distintos departamentos"
                        />
                      )}
                    />

                    <Autocomplete
                      multiple
                      options={departamentos}
                      getOptionLabel={(opt) => opt.nombre}
                      value={selectedDeptos}
                      onChange={(_, value) => setSelectedDeptos(value)}
                      isOptionEqualToValue={(opt, value) => opt.id === value.id}
                      renderTags={(value, getTagProps) =>
                        value.map((opt, index) => (
                          <Chip
                            {...getTagProps({ index })}
                            key={opt.id}
                            label={opt.nombre}
                            size="small"
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Departamento(s) completo(s)"
                          helperText="Llega a la bandeja de todos los funcionarios de cada departamento elegido"
                        />
                      )}
                    />

                    {!destinoValido && (
                      <Alert severity="info">
                        Elige al menos un destino: funcionario(s), departamento(s), o ambos a la vez.
                      </Alert>
                    )}

                    {usuariosAbsorbidos.length > 0 && (
                      <Alert severity="info">
                        {usuariosAbsorbidos.map((u) => u.nombre).join(', ')}
                        {usuariosAbsorbidos.length === 1 ? ' ya está incluido' : ' ya están incluidos'} en
                        {' '}{selectedDeptos.length === 1 ? 'el departamento elegido' : 'los departamentos elegidos'},
                        así que {usuariosAbsorbidos.length === 1 ? 'recibirá la correspondencia' : 'recibirán la correspondencia'}{' '}
                        por esa vía y no se {usuariosAbsorbidos.length === 1 ? 'creará una derivación aparte a su nombre' : 'crearán derivaciones aparte a su nombre'}.
                        Quita el departamento si necesitas que {usuariosAbsorbidos.length === 1 ? 'quede' : 'queden'} con acuse de recibo personal.
                      </Alert>
                    )}

                    {destinoValido && (
                      <Typography variant="caption" color="text.secondary">
                        Recibirán esta correspondencia <strong>{alcanceDestinos}</strong>{' '}
                        {alcanceDestinos === 1 ? 'funcionario' : 'funcionarios'}
                        {detalleDestinos && ` — ${detalleDestinos}`}.
                      </Typography>
                    )}
                  </>
                )}

                {tipoDestino === 'todos' && (
                  <Alert severity="warning">
                    Se derivará a <strong>todos los funcionarios activos</strong> del municipio
                    ({usuariosSeleccionables.length}). Cada uno la recibirá en su bandeja de entrada.
                  </Alert>
                )}
              </>
            ) : (
              <>
                <Autocomplete
                  options={departamentos}
                  getOptionLabel={(opt) => opt.nombre}
                  value={selectedDepto}
                  onChange={(_, value) => {
                    setSelectedDepto(value)
                    setSelectedUsuario(null)
                  }}
                  readOnly={readOnly}
                  renderInput={(params) => (
                    <TextField {...params} label="Departamento destino" required />
                  )}
                />
                <Autocomplete
                  options={filteredUsuarios}
                  getOptionLabel={(opt) => `${opt.nombre} (${opt.rut})`}
                  value={selectedUsuario}
                  onChange={(_, value) => setSelectedUsuario(value)}
                  readOnly={readOnly}
                  renderInput={(params) => (
                    <TextField {...params} label="Usuario destino (opcional)" />
                  )}
                />
              </>
            )}

            {esModoFuncionario && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  PARA:
                </Typography>
                <Alert severity="info" sx={{ mb: 1 }}>
                  Seleccione las acciones requeridas para esta derivacion
                </Alert>
                <FormGroup>
                  {ACCIONES_PARA_OPTIONS.map((accion) => (
                    <FormControlLabel
                      key={accion}
                      control={
                        <Checkbox
                          checked={accionesPara.includes(accion)}
                          onChange={() => handleToggleAccion(accion)}
                          size="small"
                        />
                      }
                      label={accion}
                    />
                  ))}
                </FormGroup>
              </Box>
            )}

            <TextField
              label="Observaciones"
              multiline
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading || previewLoading}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || previewLoading || !destinoValido}
        >
          {loading || previewLoading ? <CircularProgress size={20} /> : 'Derivar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DerivacionDialog
