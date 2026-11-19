import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from './api';
import { CONFIG } from './config';
import { Session } from './session';
export type WorkspaceProfile = {
  fullName: string;
  email: string;
  companyId: string | null;
  workspaces: { companyId: string; companyName: string; timezone: string }[];
};
@Injectable({ providedIn: 'root' })
export class Workspace {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly config = inject(CONFIG);
  readonly profile = signal<WorkspaceProfile | null>(null);
  readonly current = computed(() =>
    this.profile()?.workspaces.find(
      (item) => item.companyId === this.session.identity()?.companyId,
    ),
  );
  async load() {
    const token = this.session.identity()?.token;
    this.profile.set(null);
    if (!token) return;
    const profile = await firstValueFrom(this.api.get<WorkspaceProfile>('/me'));
    if (this.session.identity()?.token !== token) return;
    const current = profile.workspaces.find((item) => item.companyId === profile.companyId);
    if (current) {
      new Intl.DateTimeFormat('es', { timeZone: current.timezone });
      this.config.companyTimezone = current.timezone;
    }
    this.profile.set(profile);
  }
}
