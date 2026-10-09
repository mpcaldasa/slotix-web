import { Routes } from '@angular/router';
import { authGuard, unsavedGuard } from './core/guards';
const authenticated = { canActivate: [authGuard] };
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth.page').then((m) => m.AuthPage),
    data: { mode: 'company', title: 'Acceso de compañía' },
  },
  {
    path: 'platform/login',
    loadComponent: () => import('./features/auth/auth.page').then((m) => m.AuthPage),
    data: { mode: 'platform', title: 'Acceso de plataforma' },
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/auth.page').then((m) => m.AuthPage),
    data: { mode: 'recover', title: 'Recuperar contraseña' },
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/auth.page').then((m) => m.AuthPage),
    data: { mode: 'reset', title: 'Restablecer contraseña' },
  },
  {
    path: 'accept-invitation',
    loadComponent: () => import('./features/auth/auth.page').then((m) => m.AuthPage),
    data: { mode: 'invitation', title: 'Aceptar invitación' },
  },
  {
    path: 'bookings/new',
    ...authenticated,
    canDeactivate: [unsavedGuard],
    data: {
      context: 'company',
      roles: ['COMPANY_ADMIN', 'BOOKING_MANAGER', 'CUSTOMER'],
      title: 'Crear reserva',
    },
    loadComponent: () =>
      import('./features/bookings/bookings.page').then((m) => m.BookingCreatePage),
  },
  {
    path: 'bookings/:id',
    ...authenticated,
    canDeactivate: [unsavedGuard],
    data: {
      context: 'company',
      roles: ['COMPANY_ADMIN', 'BOOKING_MANAGER', 'CUSTOMER'],
      title: 'Detalle de reserva',
    },
    loadComponent: () =>
      import('./features/bookings/bookings.page').then((m) => m.BookingDetailPage),
  },
  {
    path: 'bookings',
    ...authenticated,
    data: {
      context: 'company',
      roles: ['COMPANY_ADMIN', 'BOOKING_MANAGER', 'CUSTOMER'],
      title: 'Reservas',
    },
    loadComponent: () => import('./features/bookings/bookings.page').then((m) => m.BookingsPage),
  },
  {
    path: 'calendar',
    ...authenticated,
    data: {
      context: 'company',
      roles: ['COMPANY_ADMIN', 'BOOKING_MANAGER', 'CUSTOMER'],
      title: 'Calendario',
      calendar: true,
    },
    loadComponent: () => import('./features/bookings/bookings.page').then((m) => m.BookingsPage),
  },
  {
    path: 'resources/:id',
    ...authenticated,
    canDeactivate: [unsavedGuard],
    data: {
      context: 'company',
      roles: ['COMPANY_ADMIN', 'BOOKING_MANAGER', 'CUSTOMER'],
      title: 'Detalle de recurso',
    },
    loadComponent: () =>
      import('./features/resources/resource-detail').then((m) => m.ResourceDetailPage),
  },
  {
    path: 'resources',
    ...authenticated,
    canDeactivate: [unsavedGuard],
    data: {
      context: 'company',
      roles: ['COMPANY_ADMIN', 'BOOKING_MANAGER', 'CUSTOMER'],
      title: 'Recursos',
    },
    loadComponent: () => import('./features/resources/resources-page').then((m) => m.ResourcesPage),
  },
  {
    path: 'members',
    ...authenticated,
    canDeactivate: [unsavedGuard],
    data: { context: 'company', roles: ['COMPANY_ADMIN'], title: 'Miembros' },
    loadComponent: () => import('./features/members/members.page').then((m) => m.MembersPage),
  },
  {
    path: 'policies',
    ...authenticated,
    canDeactivate: [unsavedGuard],
    data: { context: 'company', roles: ['COMPANY_ADMIN'], title: 'Políticas' },
    loadComponent: () => import('./features/policies/policies-page').then((m) => m.PoliciesPage),
  },
  {
    path: 'platform/companies',
    ...authenticated,
    canDeactivate: [unsavedGuard],
    data: { context: 'platform', roles: ['PLATFORM_ADMIN'], title: 'Compañías' },
    loadComponent: () => import('./features/platform/platform.page').then((m) => m.PlatformPage),
  },
  {
    path: 'platform/users',
    ...authenticated,
    canDeactivate: [unsavedGuard],
    data: { context: 'platform', roles: ['PLATFORM_ADMIN'], title: 'Usuarios globales' },
    loadComponent: () => import('./features/platform/platform.page').then((m) => m.PlatformPage),
  },
  {
    path: 'operations',
    ...authenticated,
    canDeactivate: [unsavedGuard],
    data: { context: 'platform', roles: ['PLATFORM_ADMIN'], title: 'Operaciones' },
    loadComponent: () =>
      import('./features/operations/operations.page').then((m) => m.OperationsPage),
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./shared/problem.page').then((m) => m.ProblemPage),
    data: { forbidden: true, title: 'Acceso denegado' },
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: '**',
    loadComponent: () => import('./shared/problem.page').then((m) => m.ProblemPage),
    data: { title: 'Página no encontrada' },
  },
];
