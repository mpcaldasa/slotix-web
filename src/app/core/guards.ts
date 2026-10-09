import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { Session } from './session';
import { DialogService } from '../shared/dialog';
import type { Role } from './models';
export const authGuard: CanActivateFn = (route) => {
  const session = inject(Session);
  const router = inject(Router);
  if (!session.identity()) return router.createUrlTree(['/login']);
  const allowed = route.data['roles'] as Role[] | undefined;
  const context = route.data['context'] as string | undefined;
  if (
    (context === 'company' && !session.identity()?.companyId) ||
    (context === 'platform' && !session.platform()) ||
    (allowed && !session.has(...allowed))
  )
    return router.createUrlTree(['/forbidden']);
  return true;
};
export interface Unsaved {
  hasUnsavedChanges(): boolean;
}
export const unsavedGuard: CanDeactivateFn<Unsaved> = (component) =>
  !component.hasUnsavedChanges() ||
  inject(DialogService).confirm(
    'Descartar cambios',
    'Los cambios que no guardaste se perderán.',
    'Descartar',
  );
