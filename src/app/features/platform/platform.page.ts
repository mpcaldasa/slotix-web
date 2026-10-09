import { Component, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { ApiError, Company, Page, PlatformUser, Schema } from '../../core/models';
import { apiError } from '../../core/errors';
import { EditorComponent, Field, passwordBytes, UUID_PATTERN } from '../../shared/editor';
import { ErrorComponent, Feedback, StatusComponent } from '../../shared/feedback';
import { DialogService } from '../../shared/dialog';
import { label, yesNo } from '../../shared/labels';
import { PlatformService } from './platform.service';
type Mode = 'onboard' | 'legacy' | 'initialize';
const companyFields: Field[] = [
  { key: 'legalName', label: 'Razón social', required: true, maxLength: 200 },
  { key: 'displayName', label: 'Nombre de compañía', required: true, maxLength: 150 },
  {
    key: 'slug',
    label: 'Identificador corto',
    required: true,
    maxLength: 80,
    pattern: '[a-z0-9]+(?:-[a-z0-9]+)*',
    hint: 'Letras minúsculas, números y guiones; máximo 80 caracteres.',
  },
  {
    key: 'contactEmail',
    label: 'Correo de contacto',
    type: 'email',
    required: true,
    maxLength: 320,
  },
];
const identityFields: Field[] = [
  {
    key: 'existingUserId',
    label: 'ID del administrador existente',
    pattern: UUID_PATTERN,
    hint: 'Opcional. Si se completa, no ingreses datos de un usuario nuevo.',
  },
  { key: 'email', label: 'Correo del administrador nuevo', type: 'email', maxLength: 320 },
  { key: 'fullName', label: 'Nombre completo del administrador nuevo', maxLength: 200 },
  {
    key: 'password',
    label: 'Contraseña inicial del administrador nuevo',
    type: 'password',
    maxLength: 72,
    validators: [passwordBytes],
    hint: '8 a 72 caracteres y máximo 72 bytes UTF-8.',
    autocomplete: 'new-password',
  },
];
@Component({
  selector: 'app-platform-page',
  imports: [RouterLink, EditorComponent, ErrorComponent, StatusComponent],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Plataforma</p>
        <h1>{{ usersMode ? 'Usuarios globales' : 'Compañías' }}</h1>
        <p>
          {{
            usersMode
              ? 'Administra el acceso global y los roles de plataforma.'
              : 'Crea compañías y establece su primer administrador.'
          }}
        </p>
      </div>
      <nav class="actions" aria-label="Administración de plataforma">
        <a routerLink="/platform/companies">Compañías</a
        ><a routerLink="/platform/users">Usuarios globales</a>
      </nav>
    </header>
    <app-error [error]="error()" />
    @if (!usersMode) {
      <div class="actions">
        <button class="primary" [disabled]="busy()" (click)="open('onboard')">
          Crear compañía con administrador</button
        ><button [disabled]="busy()" (click)="open('legacy')">Crear compañía pendiente</button>
      </div>
    }
    @if (mode()) {
      <section class="panel">
        <h2>
          {{
            mode() === 'initialize'
              ? 'Asignar administrador inicial'
              : mode() === 'legacy'
                ? 'Compañía pendiente'
                : 'Nueva compañía y administrador'
          }}
        </h2>
        <p>
          Las compañías nuevas usan America/Bogota. Para el administrador elige una identidad
          existente o completa los tres campos de una nueva.
        </p>
        <app-editor
          [fields]="fields()"
          [busy]="busy()"
          (saved)="save($event)"
          (cancelled)="close()"
        />
      </section>
    }
    @if (loading()) {
      <app-status [loading]="true" />
    } @else if (usersMode) {
      <section class="panel">
        <div class="table-wrap">
          <table>
            <caption>
              Usuarios globales ·
              {{
                users().totalElements
              }}
              cuentas
            </caption>
            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col">Estado</th>
                <th scope="col">Roles</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (user of users().items; track user.id) {
                <tr>
                  <td>
                    {{ user.fullName }}<small>{{ user.email }}</small
                    ><small>{{ user.id }}</small>
                  </td>
                  <td>{{ label(user.status) }}</td>
                  <td>
                    {{ user.platformRoles.map(label).join(', ') || 'Sin roles de plataforma' }}
                  </td>
                  <td>
                    <div class="actions">
                      <button
                        [disabled]="busy()"
                        (click)="
                          changeUser(user, user.status === 'ACTIVE' ? 'deactivate' : 'reactivate')
                        "
                      >
                        {{ user.status === 'ACTIVE' ? 'Desactivar cuenta' : 'Reactivar cuenta' }}
                      </button>
                      @if (user.platformRoles.includes('PLATFORM_ADMIN')) {
                        <button [disabled]="busy()" (click)="changeUser(user, 'revoke')">
                          Retirar administrador
                        </button>
                      } @else if (user.status === 'ACTIVE') {
                        <button [disabled]="busy()" (click)="changeUser(user, 'platform-admin')">
                          Otorgar administrador
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">No hay usuarios en esta página.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <nav class="actions" aria-label="Páginas de usuarios">
          <button [disabled]="page() === 0 || busy()" (click)="paginate(-1)">Anterior</button
          ><span>Página {{ page() + 1 }} de {{ users().totalPages || 1 }}</span
          ><button [disabled]="page() + 1 >= users().totalPages || busy()" (click)="paginate(1)">
            Siguiente
          </button>
        </nav>
      </section>
    } @else {
      <section class="panel">
        <div class="table-wrap">
          <table>
            <caption>
              Compañías autorizadas
            </caption>
            <thead>
              <tr>
                <th scope="col">Compañía</th>
                <th scope="col">Estado</th>
                <th scope="col">Zona horaria</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (company of companies(); track company.id) {
                <tr>
                  <td>
                    {{ company.displayName
                    }}<small>{{ company.legalName }} · {{ company.slug }}</small
                    ><small>{{ company.id }}</small
                    ><small>{{ company.contactEmail }}</small>
                  </td>
                  <td>{{ label(company.status) }}</td>
                  <td>{{ company.timezone }}</td>
                  <td>
                    <div class="actions">
                      @if (company.status === 'PENDING') {
                        <button [disabled]="busy()" (click)="activate(company)">Activar</button>
                      }
                      @if (company.status === 'PENDING' || company.status === 'ACTIVE') {
                        <button [disabled]="busy()" (click)="open('initialize', company.id)">
                          Asignar primer administrador
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">No hay compañías. Crea una para comenzar.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
})
export class PlatformPage {
  private readonly service = inject(PlatformService);
  private readonly dialog = inject(DialogService);
  private readonly feedback = inject(Feedback);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly usersMode =
    this.route.snapshot.url.some((segment) => segment.path === 'users') ||
    this.router.url.startsWith('/platform/users');
  readonly companies = signal<Company[]>([]);
  readonly users = signal<Page<PlatformUser>>({
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  readonly page = signal(Math.max(0, Number(this.route.snapshot.queryParamMap.get('page')) || 0));
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly mode = signal<Mode | null>(null);
  readonly fields = signal<Field[]>([]);
  readonly editor = viewChild(EditorComponent);
  private companyId = '';
  readonly label = label;
  constructor() {
    void this.load();
  }
  hasUnsavedChanges() {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }
  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (this.usersMode) this.users.set(await firstValueFrom(this.service.users(this.page())));
      else this.companies.set(await firstValueFrom(this.service.companies()));
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async open(mode: Mode, id = '') {
    if (
      this.hasUnsavedChanges() &&
      !(await this.dialog.confirm(
        'Descartar cambios',
        'Los datos sin guardar se perderán.',
        'Descartar',
      ))
    )
      return;
    this.companyId = id;
    this.fields.set(
      mode === 'legacy'
        ? companyFields
        : mode === 'initialize'
          ? identityFields
          : [...companyFields, ...identityFields],
    );
    this.mode.set(mode);
    this.error.set(null);
  }
  async close() {
    if (
      this.hasUnsavedChanges() &&
      !(await this.dialog.confirm(
        'Descartar cambios',
        'Los datos sin guardar se perderán.',
        'Descartar',
      ))
    )
      return;
    this.mode.set(null);
  }
  async save(v: Record<string, string>) {
    if (this.busy()) return;
    const mode = this.mode();
    if (!mode) return;
    let administrator: Schema<'InitialAdministratorRequest'> = {};
    if (mode !== 'legacy') {
      const existing = v['existingUserId']?.trim();
      if (existing) {
        if (v['email'] || v['password'] || v['fullName']) {
          this.error.set({
            status: 422,
            code: 'ADMINISTRATOR_IDENTITY_INVALID',
            error: 'Elige una identidad existente o una nueva; no ambas.',
            fields: {},
          });
          return;
        }
        administrator = { existingUserId: existing };
      } else {
        if (!v['email'] || !v['fullName'] || (v['password']?.length ?? 0) < 8) {
          this.error.set({
            status: 422,
            code: 'VALIDATION_FAILED',
            error:
              'Completa correo, nombre y contraseña de al menos 8 caracteres para el administrador nuevo.',
            fields: {},
          });
          return;
        }
        administrator = {
          newUser: { email: v['email'], fullName: v['fullName'], password: v['password'] },
        };
      }
    }
    const company: Schema<'CreateCompanyRequest'> = {
      legalName: v['legalName'] ?? '',
      displayName: v['displayName'] ?? '',
      slug: v['slug'] ?? '',
      contactEmail: v['contactEmail'] ?? '',
    };
    this.busy.set(true);
    this.error.set(null);
    try {
      if (mode === 'legacy') await firstValueFrom(this.service.createCompany(company));
      else if (mode === 'initialize')
        await firstValueFrom(this.service.initialize(this.companyId, administrator));
      else await firstValueFrom(this.service.onboard({ company, administrator }));
      this.editor()?.markSaved();
      this.mode.set(null);
      this.feedback.success('Compañía y acceso inicial actualizados.');
      await this.load();
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async activate(company: Company) {
    if (
      this.busy() ||
      !(await this.dialog.confirm(
        'Activar compañía',
        `Se habilitará la compañía ${company.displayName}. La asignación del administrador es una operación separada.`,
        'Activar',
      ))
    )
      return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.service.activateCompany(company.id));
      this.feedback.success('Compañía activada.');
      await this.load();
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async changeUser(
    user: PlatformUser,
    action: 'deactivate' | 'reactivate' | 'platform-admin' | 'revoke',
  ) {
    if (
      this.busy() ||
      !(await this.dialog.confirm(
        'Cambiar acceso global',
        `Se cambiará el acceso de ${user.fullName}. La desactivación afecta todas sus compañías. El servidor protege al último administrador activo.`,
        'Confirmar cambio',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        action === 'revoke'
          ? this.service.revoke(user.id)
          : this.service.userAction(user.id, action),
      );
      this.feedback.success('Acceso global actualizado.');
      await this.load();
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async paginate(delta: number) {
    this.page.update((page) => page + delta);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: this.page() },
      queryParamsHandling: 'merge',
    });
    await this.load();
  }
}
