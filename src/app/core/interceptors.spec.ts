import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor, isApiUrl } from './interceptors';
import { CONFIG } from './config';
import { Session } from './session';
import { Api } from './api';
describe('HTTP API boundary and session handling', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let session: Session;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIG, useValue: { apiBaseUrl: '/api', companyTimezone: 'America/Bogota' } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.identity.set({
      token: 'private-token',
      userId: 'user',
      companyId: 'company',
      roles: ['CUSTOMER'],
      expiresAt: Date.now() + 60000,
    });
  });
  afterEach(() => {
    controller.verify();
    session.clear();
  });
  it('never authorizes adjacent paths or foreign origins', () => {
    expect(isApiUrl('/api/v1/bookings', '/api', 'https://slotix.test')).toBe(true);
    expect(isApiUrl('/api-extra', '/api', 'https://slotix.test')).toBe(false);
    expect(isApiUrl('https://other.test/api/v1/bookings', '/api', 'https://slotix.test')).toBe(
      false,
    );
    http.get('https://other.test/api/v1/bookings').subscribe();
    const request = controller.expectOne('https://other.test/api/v1/bookings');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
  it('authorizes protected API calls but excludes credential routes', () => {
    http.get('/api/v1/bookings').subscribe();
    const request = controller.expectOne('/api/v1/bookings');
    expect(request.request.headers.get('Authorization')).toBe('Bearer private-token');
    request.flush({});
    http.post('/api/users/login', {}).subscribe();
    const login = controller.expectOne('/api/users/login');
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush({});
  });
  it('clears revoked identity on 401 but preserves identity on 403', () => {
    http.get('/api/v1/bookings').subscribe({ error: () => undefined });
    controller
      .expectOne('/api/v1/bookings')
      .flush({ code: 'ACCESS_DENIED' }, { status: 403, statusText: 'Forbidden' });
    expect(session.identity()).not.toBeNull();
    http.get('/api/v1/bookings').subscribe({ error: () => undefined });
    controller
      .expectOne('/api/v1/bookings')
      .flush({ code: 'AUTHENTICATION_REQUIRED' }, { status: 401, statusText: 'Unauthorized' });
    expect(session.identity()).toBeNull();
  });
  it('does not clear a new identity after a stale request fails', () => {
    http.get('/api/v1/bookings').subscribe({ error: () => undefined });
    const request = controller.expectOne('/api/v1/bookings');
    session.identity.set({ ...session.identity()!, token: 'new-token' });
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.identity()?.token).toBe('new-token');
  });
  it('preserves idempotency key and does not automatically retry writes', () => {
    TestBed.inject(Api)
      .post('/v1/bookings', { resourceId: 'resource' }, 'same-operation-key')
      .subscribe({ error: () => undefined });
    const request = controller.expectOne('/api/v1/bookings');
    expect(request.request.headers.get('Idempotency-Key')).toBe('same-operation-key');
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    controller.expectNone('/api/v1/bookings');
  });
});
