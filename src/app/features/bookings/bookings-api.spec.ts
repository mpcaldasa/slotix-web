import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CONFIG } from '../../core/config';
import { Session } from '../../core/session';
import { BookingsApi } from './bookings-api';

describe('booking HTTP contract', () => {
  let api: BookingsApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIG, useValue: { apiBaseUrl: '/api', companyTimezone: 'America/Bogota' } },
      ],
    });
    api = TestBed.inject(BookingsApi);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(Session).identity.set({
      token: 'test',
      userId: 'user',
      companyId: 'company',
      roles: ['CUSTOMER'],
      expiresAt: Date.now() + 60000,
    });
  });
  afterEach(() => http.verify());

  it('uses versioned booking and calendar paths with date-time bounds', () => {
    api.list('2026-10-09T05:00:00Z', '2026-10-10T05:00:00Z').subscribe();
    const bookings = http.expectOne(
      '/api/v1/bookings?from=2026-10-09T05:00:00Z&to=2026-10-10T05:00:00Z',
    );
    expect(bookings.request.method).toBe('GET');
    bookings.flush([]);

    api.list('from', 'to', true).subscribe();
    http.expectOne('/api/v1/calendar?from=from&to=to').flush([]);

    api.detail('booking id').subscribe();
    http.expectOne('/api/v1/bookings/booking%20id').flush({});
  });

  it('sends creation idempotency and uses documented lifecycle paths', () => {
    api.create({ resourceId: 'resource', startAt: 'start', endAt: 'end' }, 'retry-key').subscribe();
    const create = http.expectOne('/api/v1/bookings');
    expect(create.request.method).toBe('POST');
    expect(create.request.headers.get('Idempotency-Key')).toBe('retry-key');
    create.flush({});

    api.cancel('booking/id', 'reason').subscribe();
    const cancel = http.expectOne('/api/v1/bookings/booking%2Fid/cancel');
    expect(cancel.request.body).toEqual({ reason: 'reason' });
    cancel.flush({});

    api.action('booking', 'check-in').subscribe();
    http.expectOne('/api/v1/bookings/booking/check-in').flush({});
    api.reschedule('booking', 'start', 'end').subscribe();
    const reschedule = http.expectOne('/api/v1/bookings/booking/reschedule');
    expect(reschedule.request.method).toBe('PUT');
    expect(reschedule.request.body).toEqual({ startAt: 'start', endAt: 'end' });
    reschedule.flush({});
  });
});
