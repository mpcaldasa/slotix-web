import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { CONFIG } from './config';
import { Session } from './session';
export function isApiUrl(url: string, apiBase: string, origin: string): boolean {
  const target = new URL(url, origin);
  const api = new URL(apiBase, origin);
  return (
    target.origin === api.origin &&
    (target.pathname === api.pathname || target.pathname.startsWith(api.pathname + '/'))
  );
}
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(Session);
  const config = inject(CONFIG);
  if (!isApiUrl(request.url, config.apiBaseUrl, location.origin)) return next(request);
  let identity = session.identity();
  if (identity && identity.expiresAt <= Date.now()) {
    session.clear('Tu sesión expiró. Vuelve a iniciar sesión.');
    identity = null;
  }
  const publicPath =
    /\/(users\/login|platform\/login|password-resets(?:\/confirm)?|invitations\/accept)$/.test(
      new URL(request.url, location.origin).pathname,
    );
  const sentIdentity = identity;
  return next(
    identity && !publicPath
      ? request.clone({ setHeaders: { Authorization: `Bearer ${identity.token}` } })
      : request,
  ).pipe(
    catchError((error: unknown) => {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 401 &&
        sentIdentity === session.identity() &&
        !publicPath
      ) {
        session.clear('Tu sesión expiró o tu acceso fue revocado. Vuelve a iniciar sesión.');
      }
      return throwError(() => error);
    }),
  );
};
