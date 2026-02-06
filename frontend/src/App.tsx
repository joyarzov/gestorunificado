import { Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './components/auth/PrivateRoute'
import RoleSelectorDialog from './components/auth/RoleSelectorDialog'
import AppLayout from './components/layout/AppLayout'

// Pages
import Login from './pages/auth/Login'
import PublicHome from './pages/PublicHome'
import Portal from './pages/Portal'

// Correspondencia
import CorrespondenciaList from './pages/correspondencia/List'
import CorrespondenciaCreate from './pages/correspondencia/Create'
import CorrespondenciaDetail from './pages/correspondencia/Detail'
import BandejaEntrada from './pages/correspondencia/Bandeja'
import CorrespondenciaSearch from './pages/correspondencia/Search'

// OIRS
import OirsPublicForm from './pages/oirs/PublicForm'
import OirsPublicConsult from './pages/oirs/PublicConsult'
import OirsAdminList from './pages/oirs/AdminList'
import OirsAdminDetail from './pages/oirs/AdminDetail'
import OirsFuncionarioList from './pages/oirs/FuncionarioList'
import OirsFuncionarioDetail from './pages/oirs/FuncionarioDetail'

// Gestor Documental
import GestorDashboard from './pages/gestor/Dashboard'
import ExpedientesList from './pages/gestor/ExpedientesList'
import ExpedienteNew from './pages/gestor/ExpedienteNew'
import ExpedienteDetail from './pages/gestor/ExpedienteDetail'
import DocumentosList from './pages/gestor/DocumentosList'
import DocumentoNew from './pages/gestor/DocumentoNew'
import DocumentoDetail from './pages/gestor/DocumentoDetail'
import PendientesFirma from './pages/gestor/PendientesFirma'

// Admin
import Administracion from './pages/admin/Administracion'
import UsuariosManage from './pages/admin/UsuariosManage'
import DepartamentosManage from './pages/admin/DepartamentosManage'
import ChangePassword from './pages/auth/ChangePassword'

function App() {
  return (
    <>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/" element={<PublicHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/oirs" element={<OirsPublicForm />} />
        <Route path="/oirs/consultar" element={<OirsPublicConsult />} />

        {/* Rutas protegidas */}
        <Route element={<PrivateRoute />}>
          {/* Portal (sin layout) */}
          <Route path="/portal" element={<Portal />} />

          {/* Con AppLayout */}
          <Route element={<AppLayout />}>
            <Route path="/cambiar-password" element={<ChangePassword />} />

            {/* Correspondencia */}
            <Route path="/correspondencia" element={<CorrespondenciaList />} />
            <Route path="/bandeja" element={<BandejaEntrada />} />
            <Route path="/ingresar" element={<CorrespondenciaCreate />} />
            <Route path="/correspondencia/:id" element={<CorrespondenciaDetail />} />
            <Route path="/correspondencia/:id/editar" element={<CorrespondenciaCreate />} />
            <Route path="/buscar" element={<CorrespondenciaSearch />} />

            {/* OIRS Admin */}
            <Route path="/oirs-admin" element={<OirsAdminList />} />
            <Route path="/oirs-admin/:id" element={<OirsAdminDetail />} />

            {/* OIRS Funcionario */}
            <Route path="/mis-solicitudes" element={<OirsFuncionarioList />} />
            <Route path="/mis-solicitudes/:id" element={<OirsFuncionarioDetail />} />

            {/* Gestor Documental */}
            <Route path="/gestor-documental" element={<GestorDashboard />} />
            <Route path="/expedientes" element={<ExpedientesList />} />
            <Route path="/expedientes/nuevo" element={<ExpedienteNew />} />
            <Route path="/expedientes/:id" element={<ExpedienteDetail />} />
            <Route path="/expedientes/:id/editar" element={<ExpedienteNew />} />
            <Route path="/documentos" element={<DocumentosList />} />
            <Route path="/documentos/nuevo" element={<DocumentoNew />} />
            <Route path="/documentos/:id" element={<DocumentoDetail />} />
            <Route path="/pendientes-firma" element={<PendientesFirma />} />

            {/* Administración */}
            <Route path="/administracion" element={<Administracion />} />
            <Route path="/usuarios" element={<UsuariosManage />} />
            <Route path="/departamentos" element={<DepartamentosManage />} />
          </Route>
        </Route>

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Diálogo de selección de perfil (global) */}
      <RoleSelectorDialog />
    </>
  )
}

export default App
