import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, vi } from 'vitest';
import { Session } from '../../core/session';
import { AuthPage } from './auth.page';
import { AuthService } from './auth.service';

const companyId = '11111111-1111-4111-8111-111111111111';
describe('invitation welcome and sign-in context', () => {
  afterEach(() => history.replaceState({}, '', '/'));
  it('welcomes the person by name and keeps the company code out of the message', async () => {
    const accept = vi.fn(() =>
      of({ fullName: 'Ana Torres', email: 'ana@example.test', companyId }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { accept } },
        { provide: Session, useValue: {} },
        { provide: Router, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode: 'invitation' },
              queryParamMap: convertToParamMap({ token: 'qa-link' }),
            },
          },
        },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new AuthPage());
    await page.submit({ password: 'test-password', fullName: 'Ana Torres' });
    expect(page.success()).toContain('Ana Torres');
    expect(page.success()).not.toContain(companyId);
    expect(page.success()).not.toMatch(/UTF-8|bytes/);
    expect(page.invitedCompany()).toBe(companyId);
    expect(page.invitedEmail()).toBe('ana@example.test');
  });
  it('uses the invitation company internally without asking the person to copy its code', async () => {
    history.replaceState({ companyId, email: 'ana@example.test' }, '', '/login');
    const login = vi.fn(() => of({ token: 'test-token' }));
    const navigateByUrl = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { login } },
        { provide: Session, useValue: { accept: vi.fn(), platform: () => false } },
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode: 'company' },
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new AuthPage());
    expect(page.fields.some((field) => field.key === 'companyId')).toBe(false);
    expect(page.initialValues.email).toBe('ana@example.test');
    await page.submit({ email: 'ana@example.test', password: 'test-password' });
    expect(login).toHaveBeenCalledWith(true, {
      email: 'ana@example.test',
      password: 'test-password',
      companyId,
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/bookings');
  });
});
