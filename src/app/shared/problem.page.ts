import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Session } from '../core/session';
@Component({
  selector: 'app-problem-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="panel problem">
    <p class="eyebrow">{{ forbidden ? '403' : '404' }}</p>
    <h1 tabindex="-1">{{ forbidden ? 'Acceso denegado' : 'Página no encontrada' }}</h1>
    <p>
      {{
        forbidden
          ? 'Tu identidad no tiene acceso a esta sección. Si tus permisos cambiaron, vuelve a iniciar sesión.'
          : 'La dirección no corresponde a una página de Slotix.'
      }}
    </p>
    <a
      [routerLink]="
        session.platform() ? '/platform/companies' : session.identity() ? '/bookings' : '/login'
      "
      >Volver al inicio</a
    >
  </section>`,
})
export class ProblemPage {
  readonly forbidden = inject(ActivatedRoute).snapshot.data['forbidden'] === true;
  readonly session = inject(Session);
}
