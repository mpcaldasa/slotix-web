import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from './models';
const messages: Record<string, string> = {
  INVALID_CREDENTIALS:
    'No se pudo iniciar sesión. Revisa tus credenciales, compañía y estado de acceso.',
  AUTHENTICATION_REQUIRED: 'Tu sesión expiró o dejó de ser válida. Inicia sesión de nuevo.',
  ACCESS_DENIED:
    'No tienes permiso para esta operación. Tus permisos pueden haber cambiado; vuelve a iniciar sesión.',
  COMPANY_INACTIVE: 'La compañía no está activa. Contacta a su administrador.',
  LAST_COMPANY_ADMIN_REQUIRED: 'Debe permanecer al menos un administrador de compañía activo.',
  LAST_PLATFORM_ADMIN_REQUIRED: 'Debe permanecer al menos un administrador de plataforma activo.',
  BOOKING_SLOT_UNAVAILABLE:
    'El horario ya no está disponible. Consulta disponibilidad y elige otro.',
  IDEMPOTENCY_KEY_REUSED:
    'Esta solicitud cambió después de enviarse. Revisa tus reservas antes de crear otra.',
  EMAIL_DELIVERY_UNAVAILABLE: 'El envío de correo no está habilitado. La invitación no se creó.',
  CUSTOMER_CANCELLATION_NOT_ALLOWED:
    'La política o el plazo de anticipación no permite cancelar esta reserva.',
  CUSTOMER_RESCHEDULING_NOT_ALLOWED:
    'La política o el plazo de anticipación no permite reprogramar esta reserva.',
  BOOKING_STATE_INVALID:
    'El estado o el horario de la reserva no permite esta acción. Actualiza los datos.',
  BOOKING_POLICY_ASSIGNED_CANNOT_EDIT:
    'La política está asignada. Crea otra política y sustituye la asignación cuando el servidor lo permita.',
  BOOKING_POLICY_HAS_ACTIVE_ASSIGNMENTS:
    'Cierra las asignaciones activas antes de desactivar esta política.',
  INVITATION_EXPIRED: 'La invitación expiró. Solicita una nueva al administrador.',
  PASSWORD_RESET_EXPIRED: 'El enlace expiró. Solicita otro enlace de recuperación.',
  DATA_CONFLICT:
    'Los datos cambiaron o entran en conflicto. Actualiza y revisa antes de continuar.',
};
export function apiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string') {
      const fields =
        'fields' in body && body.fields && typeof body.fields === 'object'
          ? Object.fromEntries(
              Object.entries(body.fields).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string',
              ),
            )
          : {};
      return {
        status: error.status,
        code: body.code,
        error:
          messages[body.code] ??
          (error.status === 409
            ? 'La operación entra en conflicto con los datos actuales. Actualiza y revisa los cambios.'
            : 'No se pudo completar la operación. Revisa los datos y las restricciones indicadas.'),
        fields,
      };
    }
    return {
      status: error.status,
      code: error.status === 0 ? 'NETWORK_ERROR' : 'HTTP_ERROR',
      error:
        error.status === 0
          ? 'No se pudo conectar. Una operación enviada podría haberse completado; comprueba los datos antes de repetirla.'
          : 'El servicio no respondió como se esperaba. Intenta consultar nuevamente.',
      fields: {},
    };
  }
  return {
    status: 0,
    code: 'CLIENT_ERROR',
    error: 'Revisa los valores ingresados y la configuración de zona horaria.',
    fields: {},
  };
}
