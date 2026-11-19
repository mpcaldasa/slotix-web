import { Component, DestroyRef, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../core/api';
import type { ApiError } from '../../core/models';
import { apiError } from '../../core/errors';
import { ErrorComponent, Feedback } from '../../shared/feedback';
import { DialogService } from '../../shared/dialog';
type Status = { configured: boolean; connected: boolean };
@Component({
  selector: 'app-google-calendar-page',
  imports: [ErrorComponent],
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">Compañía / Integraciones</p>
        <h1 tabindex="-1">Google Calendar</h1>
        <p>Lleva una copia de tus reservas a un calendario separado de Slotix.</p>
      </div>
    </header>
    <app-error [error]="error()" />
    <section class="panel">
      <h2>{{ status()?.connected ? 'Calendario conectado' : 'Conecta tu calendario' }}</h2>
      <p>
        Slotix solo solicita acceso al calendario que crea para tu compañía. No solicita leer tu
        agenda personal. Las copias contienen el recurso, el número de reserva y las horas; no
        incluyen nombres de clientes ni notas privadas.
      </p>
      @if (loading()) {
        <p role="status">Consultando conexión…</p>
      } @else if (status() && !status()?.configured) {
        <p role="status">
          Google Calendar aún no está habilitado en esta instalación. Tu administrador técnico debe
          completar la configuración antes de conectar una cuenta.
        </p>
      } @else if (status()?.connected) {
        <p>
          Abre el detalle de una reserva y elige «Actualizar en Google Calendar». Si cambias el
          horario o cancelas la reserva, actualiza su copia desde ese mismo detalle.
        </p>
        <p>
          La actualización es manual. Los cambios que hagas en Google no modifican tus reservas ni
          la disponibilidad en Slotix.
        </p>
        <button class="danger" [disabled]="busy()" (click)="disconnect()">
          Desconectar de Slotix
        </button>
      } @else if (status()?.configured) {
        <button class="primary" [disabled]="busy()" (click)="connect()">Conectar con Google</button>
      }
      @if (busy() && !status()?.connected) {
        <p role="status">
          Completa la autorización en la ventana de Google. Puedes cerrarla para cancelar.
        </p>
      }
      <p>
        Al desconectar se eliminan las credenciales guardadas en Slotix. El calendario y sus copias
        permanecen en Google. Puedes retirar el permiso desde
        <a href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer"
          >las conexiones de tu cuenta de Google</a
        >.
      </p>
    </section>`,
})
export class GoogleCalendarPage {
  private readonly api = inject(Api);
  private readonly feedback = inject(Feedback);
  private readonly dialogs = inject(DialogService);
  readonly status = signal<Status | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  private popup: Window | null = null;
  private expectedState = '';
  private timer?: ReturnType<typeof setInterval>;
  constructor() {
    const listener = (event: MessageEvent) => {
      void this.complete(event);
    };
    window.addEventListener('message', listener);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('message', listener);
      clearInterval(this.timer);
      this.popup?.close();
    });
    void this.load();
  }
  private path() {
    return this.api.companyPath('/google-calendar');
  }
  async load() {
    try {
      this.status.set(await firstValueFrom(this.api.get<Status>(this.path())));
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async connect() {
    if (this.busy()) return;
    this.popup = window.open('', 'slotix-google-calendar', 'popup,width=620,height=760');
    if (!this.popup) {
      this.error.set({
        status: 0,
        code: 'POPUP_BLOCKED',
        error: 'Permite abrir la ventana de Google en tu navegador y vuelve a intentarlo.',
        fields: {},
      });
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.api.post<{ authorizationUrl: string }>(this.path() + '/connect'),
      );
      const url = new URL(result.authorizationUrl);
      if (url.origin !== 'https://accounts.google.com')
        throw new Error('Invalid authorization origin');
      this.expectedState = url.searchParams.get('state') || '';
      this.popup.location.href = url.href;
      this.timer = setInterval(() => {
        if (this.popup?.closed) {
          clearInterval(this.timer);
          this.busy.set(false);
        }
      }, 500);
    } catch (error) {
      this.popup.close();
      this.busy.set(false);
      this.error.set(apiError(error));
    }
  }
  private async complete(event: MessageEvent) {
    if (
      event.origin !== location.origin ||
      event.source !== this.popup ||
      !event.data ||
      event.data.type !== 'slotix-google-calendar'
    )
      return;
    const data = event.data as { state?: string; code?: string; error?: string };
    if (data.state !== this.expectedState) return;
    clearInterval(this.timer);
    this.popup?.close();
    this.popup = null;
    try {
      if (data.error || !data.code) {
        this.error.set({
          status: 400,
          code: 'CALENDAR_AUTHORIZATION_FAILED',
          error: 'La conexión no se completó. Puedes volver a intentarlo.',
          fields: {},
        });
        return;
      }
      this.status.set(
        await firstValueFrom(
          this.api.post<Status>(this.path() + '/complete', { state: data.state, code: data.code }),
        ),
      );
      this.feedback.success(
        'Google Calendar conectado. Ya puedes copiar reservas desde su detalle.',
      );
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
      this.expectedState = '';
    }
  }
  async disconnect() {
    if (
      this.busy() ||
      !(await this.dialogs.confirm(
        'Desconectar Google Calendar',
        'Slotix dejará de acceder al calendario. Las copias existentes permanecerán en Google.',
        'Desconectar',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.delete(this.path()));
      await this.load();
      this.feedback.success('Conexión con Google Calendar eliminada de Slotix.');
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
@Component({
  selector: 'app-google-calendar-callback',
  template: `<section class="panel">
    <h1>Conexión con Google Calendar</h1>
    <p>
      Vuelve a la ventana de Slotix donde iniciaste la conexión. Si la cerraste, abre Slotix e
      intenta conectar de nuevo.
    </p>
  </section>`,
})
export class GoogleCalendarCallback {
  constructor() {
    const params = new URLSearchParams(location.search);
    const data = {
      type: 'slotix-google-calendar',
      state: params.get('state'),
      code: params.get('code'),
      error: params.get('error'),
    };
    history.replaceState({}, '', location.pathname);
    if (window.opener) {
      window.opener.postMessage(data, location.origin);
      window.close();
    }
  }
}
