import { Snackbar, Alert } from '@mui/material'
import { useAuth } from '../../contexts/AuthContext'

/**
 * Aviso puntual tras iniciar sesión (hoy: "se cerró tu sesión anterior").
 *
 * Va montado a nivel de App y no dentro de AppLayout porque el destino natural
 * después del login es /portal, que se renderiza SIN layout: ahí el aviso no se
 * vería nunca. Reemplaza al diálogo "Sesión ya en uso", que interrumpía el
 * ingreso incluso cuando la sesión anterior ya estaba vencida.
 */
const AvisoSesion = () => {
  const { avisoSesion, descartarAvisoSesion } = useAuth()

  return (
    <Snackbar
      open={Boolean(avisoSesion)}
      autoHideDuration={6000}
      onClose={descartarAvisoSesion}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Alert severity="info" variant="filled" onClose={descartarAvisoSesion} sx={{ width: '100%' }}>
        {avisoSesion}
      </Alert>
    </Snackbar>
  )
}

export default AvisoSesion
