import {
  Mail as MailIcon,
  Forum as OirsIcon,
  Description as GestorIcon,
  Storefront as FomentoIcon,
  Settings as AdminIcon,
  Dashboard as DashboardIcon,
  Inbox as InboxIcon,
  Create as CreateIcon,
  Search as SearchIcon,
  Folder as FolderIcon,
  FolderCopy as FolderCopyIcon,
  Archive as ArchiveIcon,
  PendingActions as PendingIcon,
  AssignmentInd as AssignmentIcon,
  AssignmentTurnedIn as TurnedInIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Gesture as GestureIcon,
  Tune as TuneIcon,
  AccountTree as OrganigramaIcon,
  Person as PersonIcon,
  MenuBook as LibroIcon,
  Outbox as SalidaIcon,
} from '@mui/icons-material'
import { ComponentType } from 'react'
import type { SvgIconProps } from '@mui/material'

export type ModuleId =
  | 'correspondencia'
  | 'gestor_documental'
  | 'oirs'
  | 'fomento_productivo'
  | 'administracion'
  | 'perfil'

export interface ModuleDefinition {
  id: ModuleId
  nombre: string
  descripcion: string
  color: string
  icono: ComponentType<SvgIconProps>
  rootPath: string
  urlPrefixes: string[]
}

export interface SidebarNavItem {
  text: string
  path: string
  icon: ComponentType<SvgIconProps>
  badgeKey?: 'pendientes_firma' | 'recibidos_no_leidos' | 'oirs_asignadas'
}

export const MODULES: ModuleDefinition[] = [
  {
    id: 'correspondencia',
    nombre: 'Correspondencia',
    descripcion: 'Oficina de partes, bandeja y derivaciones',
    color: '#28A9E3',
    icono: MailIcon,
    rootPath: '/correspondencia',
    urlPrefixes: ['/correspondencia', '/bandeja', '/ingresar', '/buscar', '/salidas', '/libro-correspondencia'],
  },
  {
    id: 'gestor_documental',
    nombre: 'Cero Papel',
    descripcion: 'Documentos, expedientes y firma electrónica',
    color: '#8AC53E',
    icono: GestorIcon,
    rootPath: '/gestor-documental',
    urlPrefixes: [
      '/gestor-documental',
      '/documentos',
      '/expedientes',
      '/pendientes-firma',
      '/documentos-recibidos',
      '/repositorio-documental',
      '/repositorio-expedientes',
    ],
  },
  {
    id: 'oirs',
    nombre: 'OIRS',
    descripcion: 'Solicitudes ciudadanas',
    color: '#EE5825',
    icono: OirsIcon,
    rootPath: '/oirs-admin',
    urlPrefixes: ['/oirs-admin', '/mis-solicitudes'],
  },
  {
    id: 'fomento_productivo',
    nombre: 'Fomento Productivo',
    descripcion: 'Fondos concursables y postulaciones',
    color: '#EB1B78',
    icono: FomentoIcon,
    rootPath: '/fomento-productivo',
    urlPrefixes: ['/fomento-productivo', '/fondos-concursables', '/postulaciones'],
  },
  {
    id: 'administracion',
    nombre: 'Administración',
    descripcion: 'Usuarios, departamentos y configuración',
    color: '#0071BC',
    icono: AdminIcon,
    rootPath: '/administracion',
    urlPrefixes: [
      '/administracion',
      '/usuarios',
      '/departamentos',
      '/organigrama',
      '/configuracion',
      '/firma-sellos',
    ],
  },
  {
    id: 'perfil',
    nombre: 'Mi perfil',
    descripcion: 'Datos personales, subrogante y contraseña',
    color: '#607d8b',
    icono: PersonIcon,
    rootPath: '/cambiar-password',
    urlPrefixes: ['/cambiar-password'],
  },
]

// Módulos temporalmente deshabilitados: siguen visibles en el portal y el
// selector, pero no permiten entrar. Agregar aquí los ids a bloquear.
export const MODULOS_DESHABILITADOS: ModuleId[] = []

export const isModuloDeshabilitado = (id: ModuleId | string): boolean =>
  (MODULOS_DESHABILITADOS as string[]).includes(id)

export const getModuleByPath = (pathname: string): ModuleDefinition | null => {
  return (
    MODULES.find((m) =>
      m.urlPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
    ) ?? null
  )
}

interface SidebarContext {
  role: string | null
  isAdmin: boolean
  isOficial: boolean
  isAlcalde: boolean
  canViewAllCorrespondence: boolean
}

export const getSidebarItems = (
  moduleId: ModuleId,
  ctx: SidebarContext
): SidebarNavItem[] => {
  switch (moduleId) {
    case 'correspondencia': {
      const items: SidebarNavItem[] = []
      // Dashboard y Bandeja: perfiles que reciben correspondencia derivada.
      // El oficial de partes no recibe derivaciones, así que no las ve.
      if (!ctx.isOficial) {
        items.push({ text: 'Dashboard', path: '/correspondencia', icon: DashboardIcon })
        items.push({ text: 'Bandeja de entrada', path: '/bandeja', icon: InboxIcon })
      }
      // Listado general de correspondencia: solo quienes pueden ver todo
      if (ctx.canViewAllCorrespondence) {
        items.push({ text: 'Todas las correspondencias', path: '/correspondencia/listar', icon: MailIcon })
      }
      // Gestión documental de Partes: ingreso, salidas y libro son
      // EXCLUSIVOS de oficina de partes (y admin).
      if (ctx.isOficial || ctx.isAdmin) {
        items.push({ text: 'Ingresar correspondencia', path: '/ingresar', icon: CreateIcon })
        items.push({ text: 'Salidas', path: '/salidas', icon: SalidaIcon })
        items.push({ text: 'Libro de Correspondencia', path: '/libro-correspondencia', icon: LibroIcon })
      }
      items.push({ text: 'Búsqueda avanzada', path: '/buscar', icon: SearchIcon })
      return items
    }

    case 'gestor_documental':
      return [
        { text: 'Dashboard', path: '/gestor-documental', icon: DashboardIcon },
        { text: 'Mis documentos', path: '/documentos', icon: GestorIcon },
        { text: 'Mis expedientes', path: '/expedientes', icon: FolderIcon },
        {
          text: 'Pendientes de firma',
          path: '/pendientes-firma',
          icon: PendingIcon,
          badgeKey: 'pendientes_firma',
        },
        {
          text: 'Documentos recibidos',
          path: '/documentos-recibidos',
          icon: InboxIcon,
          badgeKey: 'recibidos_no_leidos',
        },
        { text: 'Repositorio documental', path: '/repositorio-documental', icon: ArchiveIcon },
        { text: 'Repositorio expedientes', path: '/repositorio-expedientes', icon: FolderCopyIcon },
      ]

    case 'oirs': {
      const esAdmin = ctx.isAdmin || ctx.role === 'oirs'
      if (esAdmin) {
        return [
          { text: 'Dashboard', path: '/oirs-admin', icon: DashboardIcon },
          { text: 'Asignadas a mí', path: '/oirs-admin/asignadas', icon: AssignmentIcon, badgeKey: 'oirs_asignadas' },
          { text: 'Todas las solicitudes', path: '/oirs-admin/listar', icon: OirsIcon },
          { text: 'Cerradas', path: '/oirs-admin/cerradas', icon: TurnedInIcon },
        ]
      }
      return [
        { text: 'Mis solicitudes', path: '/mis-solicitudes', icon: AssignmentIcon },
      ]
    }

    case 'fomento_productivo':
      return [
        { text: 'Dashboard', path: '/fomento-productivo', icon: DashboardIcon },
      ]

    case 'administracion':
      return [
        { text: 'Panel admin', path: '/administracion', icon: DashboardIcon },
        { text: 'Organigrama', path: '/organigrama', icon: OrganigramaIcon },
        { text: 'Usuarios', path: '/usuarios', icon: PeopleIcon },
        { text: 'Departamentos', path: '/departamentos', icon: BusinessIcon },
        { text: 'Firma y sellos', path: '/firma-sellos', icon: GestureIcon },
        { text: 'Configuración', path: '/configuracion', icon: TuneIcon },
      ]

    case 'perfil':
      return [
        { text: 'Mi información', path: '/cambiar-password', icon: PersonIcon },
      ]
  }
}
