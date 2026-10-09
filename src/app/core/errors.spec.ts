import { HttpErrorResponse } from '@angular/common/http';
import { apiError } from './errors';
describe('real API error envelopes', () => {
  it('preserves codes and safe field messages', () => {
    const error = apiError(
      new HttpErrorResponse({
        status: 400,
        error: { code: 'VALIDATION_FAILED', fields: { name: 'required', hidden: 7 } },
      }),
    );
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.status).toBe(400);
    expect(error.fields).toEqual({ name: 'required' });
  });
  it('distinguishes network uncertainty, permission changes and booking conflicts', () => {
    expect(apiError(new HttpErrorResponse({ status: 0 })).code).toBe('NETWORK_ERROR');
    expect(
      apiError(new HttpErrorResponse({ status: 403, error: { code: 'ACCESS_DENIED' } })).error,
    ).toContain('permisos pueden haber cambiado');
    expect(
      apiError(new HttpErrorResponse({ status: 409, error: { code: 'BOOKING_SLOT_UNAVAILABLE' } }))
        .error,
    ).toContain('ya no está disponible');
    expect(
      apiError(new HttpErrorResponse({ status: 409, error: { code: 'NEW_CONFLICT' } })).error,
    ).toContain('conflicto');
    expect(apiError(new Error('secret')).error).not.toContain('secret');
  });
});
