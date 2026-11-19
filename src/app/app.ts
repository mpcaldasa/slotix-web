import { Workspace } from './core/workspace';
import { apiError } from './core/errors';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { Api } from './core/api';
import { Session } from './core/session';
import { CONFIG } from './core/config';
import { DialogComponent, DialogService } from './shared/dialog';
import { Feedback } from './shared/feedback';
import { label } from './shared/labels';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DialogComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly session = inject(Session);
  readonly workspace = inject(Workspace);
  readonly switching = signal(false);
  readonly workspaceError = signal('');
  readonly config = inject(CONFIG);
  readonly feedback = inject(Feedback);
  readonly label = label;
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly api = inject(Api);
  constructor() {
    let signedIn = false;
    let lastPath = '';
    effect(() => {
      const identity = this.session.identity();
      if (signedIn && !identity) {
        this.feedback.clear();
        void this.router.navigateByUrl('/login');
      }
      signedIn = !!identity;
    });
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        document.title = `${String(route.data['title'] ?? 'Slotix')} · Slotix`;
        const path = this.router.url.split('?')[0];
        if (path === lastPath) return;
        lastPath = path;
        setTimeout(() => {
          document.querySelector<HTMLElement>('#main h1')?.focus({ preventScroll: true });
          window.scrollTo({ top: 0, behavior: 'instant' });
        }, 0);
      });
  }
  async switchCompany(event: Event) {
    const select = event.target as HTMLSelectElement;
    const target = select.value;
    select.value = this.session.identity()?.companyId ?? '';
    if (this.switching() || target === this.session.identity()?.companyId) return;
    const company = this.workspace.profile()?.workspaces.find((item) => item.companyId === target);
    if (!company) return;
    if (
      !(await this.dialogs.confirm(
        'Cambiar de compañía',
        'Abriremos ' + company.companyName + '. Los cambios sin guardar se descartarán.',
        'Cambiar compañía',
      ))
    )
      return;
    this.switching.set(true);
    this.workspaceError.set('');
    try {
      const response = await firstValueFrom(
        this.api.post<{ token: string }>('/me/company', { companyId: target }),
      );
      this.session.accept(response.token);
      try {
        await this.workspace.load();
      } catch (error) {
        this.session.clear();
        throw error;
      }
      await this.router.navigateByUrl('/login', {
        skipLocationChange: true,
        state: { discardChanges: true },
      });
      await this.router.navigateByUrl('/bookings');
    } catch (error) {
      this.workspaceError.set(apiError(error).error);
    } finally {
      this.switching.set(false);
    }
  }
  async logout(): Promise<void> {
    if (
      await this.dialogs.confirm(
        'Cerrar sesión',
        'Se cerrará este acceso y se descartarán los cambios sin guardar.',
        'Cerrar sesión',
      )
    ) {
      try {
        await firstValueFrom(this.api.post<void>('/logout'));
        this.session.clear();
        this.workspace.profile.set(null);
      } catch {
        this.feedback.success(
          'Logout could not be confirmed. Please retry; your session remains active.',
        );
      }
    }
  }
}
