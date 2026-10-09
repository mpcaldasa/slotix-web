import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ResourcesApi } from './resources-api';
import { CONFIG } from '../../core/config';
import { Session } from '../../core/session';
import { apiError } from '../../core/errors';
describe('resource lifecycle HTTP contract', () => {
  let api: ResourcesApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CONFIG, useValue: { apiBaseUrl: '/api', companyTimezone: 'America/Bogota' } },
      ],
    });
    api = TestBed.inject(ResourcesApi);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(Session).identity.set({
      token: 'test',
      userId: 'user',
      companyId: 'company',
      roles: ['COMPANY_ADMIN'],
      expiresAt: Date.now() + 60000,
    });
  });
  afterEach(() => http.verify());
  it('preserves and encodes original assignment precision in close, replace and delete', () => {
    const start = '2026-10-09T09:00:00.123456-05:00';
    const path =
      '/api/v1/companies/company/resources/resource/policies/' + encodeURIComponent(start);
    api.close('resource', start, '2026-10-12T00:00:00Z').subscribe();
    const close = http.expectOne(path);
    expect(close.request.method).toBe('PUT');
    expect(close.request.body).toEqual({ effectiveTo: '2026-10-12T00:00:00Z' });
    close.flush({});
    api.replace('resource', start, 'new-policy').subscribe();
    const replace = http.expectOne(path + '/policy');
    expect(replace.request.body).toEqual({ policyId: 'new-policy' });
    replace.flush({});
    api.removeAssignment('resource', start).subscribe();
    const remove = http.expectOne(path);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });
  it('updates schedules and blocks instead of creating duplicate configuration', () => {
    api
      .saveRule('resource', 'rule', { weekday: 1, startLocalTime: '09:00', endLocalTime: '17:00' })
      .subscribe();
    const rule = http.expectOne(
      '/api/v1/companies/company/resources/resource/availability-rules/rule',
    );
    expect(rule.request.method).toBe('PUT');
    rule.flush({});
    api
      .saveBlock('resource', 'block', {
        startAt: '2026-10-09T14:00:00Z',
        endAt: '2026-10-09T15:00:00Z',
        reason: 'Maintenance',
        blockType: 'MAINTENANCE',
      })
      .subscribe();
    const block = http.expectOne('/api/v1/companies/company/resources/resource/blocks/block');
    expect(block.request.method).toBe('PUT');
    block.flush({});
  });
  it('surfaces concurrent conflict and performs no automatic retry', () => {
    let code = '';
    api.remove('resource').subscribe({ error: (error) => (code = apiError(error).code) });
    http
      .expectOne('/api/v1/companies/company/resources/resource')
      .flush({ code: 'RESOURCE_HAS_ACTIVE_BOOKINGS' }, { status: 409, statusText: 'Conflict' });
    expect(code).toBe('RESOURCE_HAS_ACTIVE_BOOKINGS');
    http.expectNone('/api/v1/companies/company/resources/resource');
  });
});
