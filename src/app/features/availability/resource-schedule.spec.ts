import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ResourceSchedule } from './resource-schedule';
import { ResourcesApi } from '../resources/resources-api';
import { CONFIG } from '../../core/config';
import { Session } from '../../core/session';
import type { Rule } from '../../core/models';
describe('schedule administration component', () => {
  const write = new Subject<Rule>();
  const api = { rules: () => of([]), blocks: () => of([]), saveRule: vi.fn(() => write) };
  beforeEach(() => {
    api.saveRule.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: ResourcesApi, useValue: api },
        { provide: CONFIG, useValue: { companyTimezone: 'America/Bogota', apiBaseUrl: '/api' } },
      ],
    });
  });
  function identity(admin: boolean) {
    TestBed.inject(Session).identity.set({
      token: 'test',
      companyId: 'company',
      userId: 'user',
      roles: admin ? ['COMPANY_ADMIN'] : ['CUSTOMER'],
      expiresAt: Date.now() + 60000,
    });
  }
  it('allows customers to inspect schedules but hides administrative actions', async () => {
    identity(false);
    const fixture = TestBed.createComponent(ResourceSchedule);
    fixture.componentRef.setInput('resourceId', 'resource');
    await fixture.whenStable();
    await fixture.componentInstance.load();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sin horarios configurados');
    expect(text).not.toContain('Añadir horario');
    await fixture.componentInstance.save({});
    expect(api.saveRule).not.toHaveBeenCalled();
  });
  it('retains failed form data and prevents duplicate writes while busy', async () => {
    identity(true);
    const fixture = TestBed.createComponent(ResourceSchedule);
    fixture.componentRef.setInput('resourceId', 'resource');
    await fixture.whenStable();
    await fixture.componentInstance.openRule();
    await fixture.whenStable();
    const values = {
      weekday: '1',
      startLocalTime: '09:00',
      endLocalTime: '17:00',
      effectiveFrom: '',
      effectiveTo: '',
    };
    fixture.componentInstance.editor()!.form.controls['startLocalTime']!.setValue('09:00');
    fixture.componentInstance.editor()!.form.markAsDirty();
    const pending = fixture.componentInstance.save(values);
    await fixture.componentInstance.save(values);
    expect(api.saveRule).toHaveBeenCalledTimes(1);
    write.error(
      new HttpErrorResponse({ status: 409, error: { code: 'AVAILABILITY_RULE_CONFLICT' } }),
    );
    await pending;
    expect(fixture.componentInstance.busy()).toBe(false);
    expect(fixture.componentInstance.error()?.code).toBe('AVAILABILITY_RULE_CONFLICT');
    expect(fixture.componentInstance.mode()).toBe('rule');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });
  it('rejects overnight rules before contacting the server', async () => {
    identity(true);
    const fixture = TestBed.createComponent(ResourceSchedule);
    fixture.componentRef.setInput('resourceId', 'resource');
    await fixture.whenStable();
    await fixture.componentInstance.openRule();
    await fixture.componentInstance.save({
      weekday: '1',
      startLocalTime: '22:00',
      endLocalTime: '02:00',
      effectiveFrom: '',
      effectiveTo: '',
    });
    expect(api.saveRule).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()?.code).toBe('INVALID_INTERVAL');
  });
});
