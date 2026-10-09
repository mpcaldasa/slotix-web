export const labels: Record<string, string> = {
  COMPANY_ADMIN: 'Administrador de compañía',
  BOOKING_MANAGER: 'Gestor de reservas',
  CUSTOMER: 'Cliente',
  PLATFORM_ADMIN: 'Administrador de plataforma',
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  DRAFT: 'Borrador',
  MAINTENANCE: 'Mantenimiento',
  SUSPENDED: 'Suspendido',
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  CHECKED_IN: 'En uso',
  COMPLETED: 'Finalizada',
  EXPIRED: 'Expirada',
  NO_SHOW: 'No asistió',
  PUBLIC: 'Público (requiere acceso)',
  MEMBERS: 'Miembros',
  PRIVATE: 'Privado',
  SPACE: 'Espacio',
  PERSON: 'Persona',
  EQUIPMENT: 'Equipo',
  SERVICE_RESOURCE: 'Servicio',
  OTHER: 'Otro',
  CLOSURE: 'Cierre',
  ADMIN_BLOCK: 'Bloqueo administrativo',
  FAILED: 'Fallida',
  SENT: 'Enviada',
  PROCESSING: 'En proceso',
  QUEUED: 'En cola',
  ARCHIVED: 'Archivada',
};
export function label(value: string): string {
  return labels[value] ?? value;
}
export function options(values: readonly string[]) {
  return values.map((value) => ({ value, label: label(value) }));
}
export const yesNo = [
  { value: 'true', label: 'Sí' },
  { value: 'false', label: 'No' },
] as const;
