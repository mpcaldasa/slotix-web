import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Session } from '../../core/session';
import { apiError } from '../../core/errors';
import type { ApiError } from '../../core/models';
import { EditorComponent, Field, UUID_PATTERN, passwordBytes } from '../../shared/editor';
import { ErrorComponent } from '../../shared/feedback';
import { AuthService } from './auth.service';
@Component({
  selector: 'app-auth-page',
  imports: [RouterLink, EditorComponent, ErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <div class="auth-layout">
    <section class="auth-story" aria-label="Slotix, plataforma de reservas">
      <a class="brand" routerLink="/login">
        <svg class="brand-symbol" aria-hidden="true" viewBox="0 0 32 32" fill="none">
          <path d="M5 7.5h22v17H5z" stroke="currentColor" stroke-width="1.7" />
          <path d="M5 13h22M11 7.5v17M21 7.5v17" stroke="currentColor" stroke-width="1.4" />
          <path d="M12 16h3v3h-3zM22 16h3v3h-3z" fill="currentColor" />
        </svg>
        <span>slotix</span>
      </a>
      <div class="auth-story-main">
        <p class="eyebrow">Reservas con contexto</p>
        <h2>El espacio que necesitas,<br /><em>cuando lo necesitas.</em></h2>
        <p>
          Una agenda para coordinar salas, canchas, equipos, vehículos, personas y servicios dentro
          de tu compañía.
        </p>
        <svg class="schedule-art" aria-hidden="true" viewBox="0 0 440 190" fill="none">
          <rect
            x="1"
            y="1"
            width="438"
            height="188"
            rx="14"
            stroke="currentColor"
            stroke-opacity=".2"
          />
          <path
            d="M82 1v188M171 1v188M260 1v188M349 1v188M1 48h438M1 95h438M1 142h438"
            stroke="currentColor"
            stroke-opacity=".16"
          />
          <rect x="96" y="16" width="62" height="25" rx="6" fill="#9BE2C2" />
          <rect x="185" y="61" width="150" height="25" rx="6" fill="#FFB28D" />
          <rect x="14" y="108" width="151" height="25" rx="6" fill="#B5C7FF" />
          <rect x="274" y="155" width="151" height="20" rx="6" fill="#9BE2C2" />
          <circle cx="27" cy="24" r="4" fill="#F7C767" />
          <circle cx="27" cy="71" r="4" fill="#F7C767" />
          <circle cx="27" cy="118" r="4" fill="#F7C767" />
          <circle cx="27" cy="165" r="4" fill="#F7C767" />
        </svg>
      </div>
      <div class="auth-story-footer">
        <span>Una sola agenda</span><span aria-hidden="true"></span><span>Tu compañía</span>
      </div>
    </section>
    <section class="auth-panel">
      <h1 tabindex="-1">{{ title }}</h1>
      <p class="muted">{{ description }}</p>
      @if (session.notice()) {
        <p class="notice" role="status">{{ session.notice() }}</p>
      }
      <app-error [error]="error()" />
      @if (success()) {
        <section class="panel" role="status">
          <p>{{ success() }}</p>
          <a routerLink="/login">Ir al acceso de compañía</a>
        </section>
      } @else {
        <app-editor
          id="auth"
          [fields]="fields"
          [busy]="busy()"
          [submitLabel]="button"
          (saved)="submit($event)"
          (cancelled)="cancel()"
        />
      }
      <nav class="auth-links" aria-label="Opciones de acceso">
        @if (mode === 'company') {
          <a routerLink="/forgot-password">¿Olvidaste tu contraseña?</a
          ><a routerLink="/platform/login">Acceso de plataforma</a>
        } @else {
          <a routerLink="/login">Acceso de compañía</a>
        }
      </nav>
    </section>
  </div>`,
})
export class AuthPage {
  readonly session = inject(Session);
  private readonly service = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly mode = String(this.route.snapshot.data['mode'] ?? 'company');
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly success = signal('');
  readonly editor = viewChild(EditorComponent);
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly title =
    this.mode === 'platform'
      ? 'Acceso de plataforma'
      : this.mode === 'recover'
        ? 'Recuperar contraseña'
        : this.mode === 'reset'
          ? 'Crear una nueva contraseña'
          : this.mode === 'invitation'
            ? 'Aceptar invitación'
            : 'Accede a tu compañía';
  readonly description =
    this.mode === 'company'
      ? 'Ingresa el identificador único de tu compañía y tus datos de acceso.'
      : this.mode === 'platform'
        ? 'Administración global de compañías y usuarios.'
        : this.mode === 'recover'
          ? 'Solicita instrucciones para recuperar tu acceso.'
          : 'Usa el enlace que recibiste por correo. La contraseña debe tener entre 8 y 72 caracteres y hasta 72 bytes UTF-8.';
  readonly button = ['company', 'platform'].includes(this.mode)
    ? 'Iniciar sesión'
    : this.mode === 'recover'
      ? 'Enviar instrucciones'
      : this.mode === 'reset'
        ? 'Guardar contraseña'
        : 'Aceptar invitación';
  readonly fields: Field[] = this.makeFields();
  constructor() {
    if (this.token) history.replaceState(history.state, '', location.pathname);
  }
  private makeFields(): Field[] {
    const fields: Field[] = [];
    if (this.mode === 'company')
      fields.push({
        key: 'companyId',
        label: 'Identificador único de tu compañía',
        required: true,
        pattern: UUID_PATTERN,
        hint: 'Es el código que identifica a tu compañía. Pídeselo a quien administra tu cuenta.',
      });
    if (['company', 'platform', 'recover'].includes(this.mode))
      fields.push({
        key: 'email',
        label: 'Correo electrónico',
        type: 'email',
        required: true,
        autocomplete: 'username',
        maxLength: 320,
      });
    if (this.mode === 'invitation')
      fields.push({
        key: 'fullName',
        label: 'Nombre completo',
        required: true,
        maxLength: 120,
        autocomplete: 'name',
      });
    if (this.mode !== 'recover')
      fields.push({
        key: 'password',
        label: 'Contraseña',
        type: 'password',
        required: true,
        autocomplete: ['reset', 'invitation'].includes(this.mode)
          ? 'new-password'
          : 'current-password',
        ...(['reset', 'invitation'].includes(this.mode)
          ? { maxLength: 72, pattern: '.{8,72}', validators: [passwordBytes] }
          : {}),
      });
    if (['reset', 'invitation'].includes(this.mode) && !this.token)
      fields.unshift({
        key: 'token',
        label: 'Token del enlace',
        type: 'password',
        required: true,
        maxLength: 128,
        hint: 'Abre el enlace del correo o ingresa el token recibido.',
      });
    return fields;
  }
  hasUnsavedChanges(): boolean {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }
  async submit(data: Record<string, string>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (['company', 'platform'].includes(this.mode)) {
        const response = await firstValueFrom(this.service.login(this.mode === 'company', data));
        this.session.accept(response.token);
        this.editor()?.markSaved();
        await this.router.navigateByUrl(
          this.session.platform() ? '/platform/companies' : '/bookings',
        );
      } else if (this.mode === 'recover') {
        await firstValueFrom(this.service.recover(data['email']));
        this.success.set('Si existe una cuenta activa, recibirás instrucciones por correo.');
      } else if (this.mode === 'reset') {
        await firstValueFrom(this.service.reset(this.token || data['token'], data['password']));
        this.session.clear();
        this.success.set('Contraseña actualizada. Inicia sesión con la nueva contraseña.');
      } else {
        const response = await firstValueFrom(
          this.service.accept(this.token || data['token'], data['password'], data['fullName']),
        );
        this.success.set(
          `Invitación aceptada. El identificador único de tu compañía es ${response.companyId}. Inicia sesión para continuar.`,
        );
      }
      this.editor()?.markSaved();
    } catch (error: unknown) {
      this.error.set(apiError(error));
      if (['company', 'platform'].includes(this.mode))
        this.editor()?.form.controls['password']?.setValue('');
    } finally {
      this.busy.set(false);
    }
  }
  cancel(): void {
    void this.router.navigateByUrl('/login');
  }
}
