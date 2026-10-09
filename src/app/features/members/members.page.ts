import { Component, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { ApiError, Membership, Page, CompanyRole } from '../../core/models';
import { Session } from '../../core/session';
import { apiError } from '../../core/errors';
import { EditorComponent, Field, passwordBytes, UUID_PATTERN } from '../../shared/editor';
import { DialogService } from '../../shared/dialog';
import { ErrorComponent, Feedback, StatusComponent } from '../../shared/feedback';
import { label, yesNo } from '../../shared/labels';
import { MembersService } from './members.service';
type Mode = 'register' | 'link' | 'invite' | 'roles';
const roleFields: Field[] = [
  {
    key: 'COMPANY_ADMIN',
    label: 'Administrador de compañía',
    type: 'select',
    required: true,
    options: yesNo,
  },
  {
    key: 'BOOKING_MANAGER',
    label: 'Gestor de reservas',
    type: 'select',
    required: true,
    options: yesNo,
  },
  { key: 'CUSTOMER', label: 'Cliente', type: 'select', required: true, options: yesNo },
];
const emailField: Field = {
  key: 'email',
  label: 'Correo electrónico',
  type: 'email',
  required: true,
  maxLength: 320,
};
@Component({
  selector: 'app-members-page',
  imports: [EditorComponent, ErrorComponent, StatusComponent],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Compañía</p>
        <h1>Miembros y acceso</h1>
        <p>Gestiona identidades, invitaciones y permisos de esta compañía.</p>
      </div>
    </header>
    <app-error [error]="error()" />
    <div class="actions">
      <button class="primary" [disabled]="busy()" (click)="open('invite')">Invitar miembro</button
      ><button [disabled]="busy()" (click)="open('register')">Crear cuenta y miembro</button
      ><button [disabled]="busy()" (click)="open('link')">Vincular usuario existente</button>
    </div>
    @if (mode()) {
      <section class="panel">
        <h2>{{ title() }}</h2>
        <p>Selecciona al menos un rol. El servidor protege al último administrador activo.</p>
        @if (mode() === 'invite') {
          <p>
            La invitación dura siete días y requiere que el backend tenga habilitado el correo. Para
            un usuario ya existente, utiliza su ID.
          </p>
        }
        <app-editor
          [fields]="fields()"
          [values]="values()"
          [busy]="busy()"
          (saved)="save($event)"
          (cancelled)="close()"
        />
      </section>
    }
    @if (loading()) {
      <app-status [loading]="true" />
    } @else {
      <section class="panel">
        <div class="table-wrap">
          <table>
            <caption>
              Miembros ·
              {{
                members().totalElements
              }}
              registros
            </caption>
            <thead>
              <tr>
                <th scope="col">Miembro</th>
                <th scope="col">Estado</th>
                <th scope="col">Roles</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (member of members().items; track member.id) {
                <tr>
                  <td>
                    {{ member.fullName }}<small>{{ member.email }}</small
                    ><small>ID de usuario: {{ member.userId }}</small>
                  </td>
                  <td>{{ label(member.status) }}</td>
                  <td>{{ member.roles.map(label).join(', ') }}</td>
                  <td>
                    <div class="actions">
                      <button [disabled]="busy()" (click)="open('roles', member)">
                        Editar roles</button
                      ><button [disabled]="busy()" (click)="changeStatus(member)">
                        {{ member.status === 'ACTIVE' ? 'Suspender' : 'Activar' }}
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">No hay miembros en esta página.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <nav class="actions" aria-label="Páginas de miembros">
          <button [disabled]="page() === 0 || busy()" (click)="paginate(-1)">Anterior</button
          ><span>Página {{ page() + 1 }} de {{ members().totalPages || 1 }}</span
          ><button [disabled]="page() + 1 >= members().totalPages || busy()" (click)="paginate(1)">
            Siguiente
          </button>
        </nav>
      </section>
    }
  `,
})
export class MembersPage {
  private readonly service = inject(MembersService);
  private readonly session = inject(Session);
  private readonly dialog = inject(DialogService);
  private readonly feedback = inject(Feedback);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly members = signal<Page<Membership>>({
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
  readonly values = signal<Record<string, string>>({});
  readonly title = signal('');
  readonly editor = viewChild(EditorComponent);
  readonly label = label;
  private selectedId = '';
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
      this.members.set(await firstValueFrom(this.service.list(this.page())));
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async open(mode: Mode, member?: Membership) {
    if (
      this.hasUnsavedChanges() &&
      !(await this.dialog.confirm(
        'Descartar cambios',
        'Los datos sin guardar se perderán.',
        'Descartar',
      ))
    )
      return;
    this.selectedId = member?.id ?? '';
    const base: Field[] =
      mode === 'register'
        ? [
            emailField,
            { key: 'fullName', label: 'Nombre completo', required: true, maxLength: 200 },
            {
              key: 'password',
              label: 'Contraseña inicial',
              type: 'password',
              required: true,
              maxLength: 72,
              validators: [passwordBytes],
              hint: '8 a 72 caracteres; máximo 72 bytes UTF-8.',
              autocomplete: 'new-password',
            },
          ]
        : mode === 'invite'
          ? [emailField]
          : mode === 'link'
            ? [
                {
                  key: 'userId',
                  label: 'ID del usuario existente',
                  required: true,
                  pattern: UUID_PATTERN,
                },
              ]
            : [];
    this.fields.set([...base, ...roleFields]);
    this.values.set({
      COMPANY_ADMIN: String(member?.roles.includes('COMPANY_ADMIN') ?? false),
      BOOKING_MANAGER: String(member?.roles.includes('BOOKING_MANAGER') ?? false),
      CUSTOMER: String(member ? member.roles.includes('CUSTOMER') : true),
    });
    this.title.set(
      mode === 'register'
        ? 'Crear cuenta y miembro'
        : mode === 'invite'
          ? 'Invitar miembro'
          : mode === 'link'
            ? 'Vincular usuario existente'
            : `Roles de ${member?.fullName ?? ''}`,
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
    const roles: CompanyRole[] = (['COMPANY_ADMIN', 'BOOKING_MANAGER', 'CUSTOMER'] as const).filter(
      (role) => v[role] === 'true',
    );
    if (!roles.length) {
      this.error.set({
        status: 422,
        code: 'VALIDATION_FAILED',
        error: 'Selecciona al menos un rol.',
        fields: {},
      });
      return;
    }
    const mode = this.mode();
    if (!mode) return;
    if (mode === 'register' && (v['password']?.length ?? 0) < 8) {
      this.error.set({
        status: 422,
        code: 'VALIDATION_FAILED',
        error: 'La contraseña debe tener al menos 8 caracteres.',
        fields: {},
      });
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      if (mode === 'register')
        await firstValueFrom(
          this.service.register({
            companyId: this.session.companyId,
            email: v['email'] ?? '',
            fullName: v['fullName'] ?? '',
            password: v['password'] ?? '',
            roles,
          }),
        );
      else if (mode === 'invite')
        await firstValueFrom(this.service.invite(v['email'] ?? '', roles));
      else if (mode === 'link') await firstValueFrom(this.service.link(v['userId'] ?? '', roles));
      else await firstValueFrom(this.service.roles(this.selectedId, roles));
      this.editor()?.markSaved();
      this.mode.set(null);
      this.feedback.success(
        mode === 'invite'
          ? 'Invitación creada y puesta en cola de correo.'
          : 'Miembro actualizado.',
      );
      await this.load();
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async changeStatus(member: Membership) {
    const action = member.status === 'ACTIVE' ? 'suspend' : 'activate';
    if (
      this.busy() ||
      !(await this.dialog.confirm(
        action === 'suspend' ? 'Suspender miembro' : 'Activar miembro',
        `${member.fullName}: este cambio afecta su acceso a esta compañía. El último administrador activo está protegido.`,
        action === 'suspend' ? 'Suspender' : 'Activar',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.service.status(member.id, action));
      this.feedback.success('Estado del miembro actualizado.');
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
