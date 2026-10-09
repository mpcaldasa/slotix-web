import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
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
  readonly config = inject(CONFIG);
  readonly feedback = inject(Feedback);
  readonly label = label;
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  constructor() {
    let signedIn = false;
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
        setTimeout(() => document.querySelector<HTMLElement>('#main h1')?.focus(), 0);
      });
  }
  async logout(): Promise<void> {
    if (
      await this.dialogs.confirm(
        'Cerrar sesión',
        'Se cerrará este acceso y se descartarán los cambios sin guardar.',
        'Cerrar sesión',
      )
    )
      this.session.clear();
  }
}
