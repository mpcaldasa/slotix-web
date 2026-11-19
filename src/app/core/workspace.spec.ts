import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { Api } from './api';
import { Session } from './session';
import { CONFIG } from './config';
import { Workspace, WorkspaceProfile } from './workspace';
import { signal } from '@angular/core';
describe('workspace profile', () => {
  it('loads company names and timezone before opening tenant pages', async () => {
    const profile = {
      fullName: 'Ana',
      email: 'ana@example.test',
      companyId: 'company',
      workspaces: [
        { companyId: 'company', companyName: 'North Courts', timezone: 'Europe/Madrid' },
      ],
    };
    const config = { companyTimezone: 'America/Bogota' };
    TestBed.configureTestingModule({
      providers: [
        { provide: Api, useValue: { get: () => of(profile) } },
        {
          provide: Session,
          useValue: { identity: signal({ token: 'token', companyId: 'company' }) },
        },
        { provide: CONFIG, useValue: config },
      ],
    });
    const workspace = TestBed.inject(Workspace);
    await workspace.load();
    expect(workspace.current()?.companyName).toBe('North Courts');
    expect(config.companyTimezone).toBe('Europe/Madrid');
  });
  it('ignores a response that belongs to a closed session', async () => {
    const response = new Subject<WorkspaceProfile>();
    const identity = signal<{ token: string; companyId: string } | null>({
      token: 'old',
      companyId: 'company',
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: Api, useValue: { get: () => response } },
        { provide: Session, useValue: { identity } },
        { provide: CONFIG, useValue: { companyTimezone: 'America/Bogota' } },
      ],
    });
    const workspace = TestBed.inject(Workspace);
    const pending = workspace.load();
    identity.set(null);
    response.next({
      fullName: 'Old',
      email: 'old@example.test',
      companyId: 'company',
      workspaces: [],
    });
    await pending;
    expect(workspace.profile()).toBeNull();
  });
});
