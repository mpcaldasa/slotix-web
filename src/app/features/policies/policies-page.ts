import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PoliciesApi } from './policies-api';
import type { ApiError, Policy, PolicyInput } from '../../core/models';
import { apiError } from '../../core/errors';
import { EditorComponent, Field } from '../../shared/editor';
import { ErrorComponent, Feedback, StatusComponent } from '../../shared/feedback';
import { DialogService } from '../../shared/dialog';
import { yesNo } from '../../shared/labels';
export const policyFields: readonly Field[] = [
  { key: 'name', label: 'Nombre', required: true, maxLength: 120 },
  {
    key: 'minDurationMinutes',
    label: 'Duración mínima (minutos)',
    type: 'number',
    required: true,
    min: 1,
    pattern: '[0-9]+',
  },
  {
    key: 'maxDurationMinutes',
    label: 'Duración máxima (minutos)',
    type: 'number',
    required: true,
    min: 1,
    pattern: '[0-9]+',
  },
  {
    key: 'slotIncrementMinutes',
    label: 'Incremento de inicio (minutos)',
    type: 'number',
    required: true,
    min: 1,
    pattern: '[0-9]+',
    hint: 'Las duraciones mínima y máxima deben ser múltiplos de este incremento.',
  },
  {
    key: 'minNoticeMinutes',
    label: 'Anticipación mínima (minutos)',
    type: 'number',
    required: true,
    min: 0,
    pattern: '[0-9]+',
  },
  {
    key: 'maxAdvanceDays',
    label: 'Anticipación máxima (días)',
    type: 'number',
    required: true,
    min: 0,
    pattern: '[0-9]+',
  },
  {
    key: 'cancellationNoticeMinutes',
    label: 'Anticipación para cancelar (minutos)',
    type: 'number',
    required: true,
    min: 0,
    pattern: '[0-9]+',
  },
  {
    key: 'approvalRequired',
    label: 'Requiere aprobación',
    type: 'select',
    required: true,
    options: yesNo,
  },
  {
    key: 'allowCustomerCancel',
    label: 'Permite cancelación por cliente',
    type: 'select',
    required: true,
    options: yesNo,
  },
];
export function policyBody(v: Record<string, string>): PolicyInput {
  const body = {
    name: v['name'].trim(),
    minDurationMinutes: Number(v['minDurationMinutes']),
    maxDurationMinutes: Number(v['maxDurationMinutes']),
    slotIncrementMinutes: Number(v['slotIncrementMinutes']),
    minNoticeMinutes: Number(v['minNoticeMinutes']),
    maxAdvanceDays: Number(v['maxAdvanceDays']),
    cancellationNoticeMinutes: Number(v['cancellationNoticeMinutes']),
    approvalRequired: v['approvalRequired'] === 'true',
    allowCustomerCancel: v['allowCustomerCancel'] === 'true',
  };
  if (
    body.minDurationMinutes > body.maxDurationMinutes ||
    body.minDurationMinutes % body.slotIncrementMinutes !== 0 ||
    body.maxDurationMinutes % body.slotIncrementMinutes !== 0
  )
    throw new Error('Invalid duration increment');
  return body;
}
@Component({
  selector: 'app-policies-page',
  imports: [EditorComponent, ErrorComponent, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">Compañía / Políticas</p>
        <h1>Políticas de reserva</h1>
        <p>Define duración, anticipación, aprobación y cancelación.</p>
      </div>
      <button class="primary" [disabled]="busy()" (click)="open()">Crear política</button>
    </header>
    <app-error [error]="error()" />
    @if (editing()) {
      <section class="panel">
        <h2>{{ selected() ? 'Editar política' : 'Nueva política' }}</h2>
        <p>
          Los términos de una política que alguna vez se asignó son inmutables. Crea una nueva para
          cambiar las condiciones.
        </p>
        <app-editor
          [fields]="fields"
          [values]="values()"
          [busy]="busy()"
          (saved)="save($event)"
          (cancelled)="cancel()"
        />
      </section>
    }
    <section class="panel">
      <div class="toolbar">
        <h2>Políticas de la compañía</h2>
        <button (click)="load()" [disabled]="busy() || loading()">Actualizar</button>
      </div>
      @if (loading()) {
        <app-status [loading]="true" />
      } @else if (!items().length) {
        <app-status
          message="Aún no hay políticas. Crea una y asígnala a un recurso para habilitar reservas."
        />
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="sr-only">
              Políticas de reserva
            </caption>
            <thead>
              <tr>
                <th>Política</th>
                <th>Duración / incremento</th>
                <th>Anticipación</th>
                <th>Aprobación</th>
                <th>Cancelación</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (policy of items(); track policy.id) {
                <tr>
                  <td>{{ policy.name }}</td>
                  <td>
                    {{ policy.minDurationMinutes }}–{{ policy.maxDurationMinutes }} min /
                    {{ policy.slotIncrementMinutes }} min
                  </td>
                  <td>{{ policy.minNoticeMinutes }} min a {{ policy.maxAdvanceDays }} días</td>
                  <td>{{ policy.approvalRequired ? 'Requerida' : 'Automática' }}</td>
                  <td>
                    {{ policy.allowCustomerCancel ? 'Permitida' : 'No permitida' }} ·
                    {{ policy.cancellationNoticeMinutes }} min
                  </td>
                  <td>{{ policy.status === 'ACTIVE' ? 'Activa' : 'Inactiva' }}</td>
                  <td>
                    <div class="actions">
                      <button [disabled]="busy()" (click)="open(policy)">Editar</button
                      ><button [disabled]="busy()" (click)="state(policy)">
                        {{ policy.status === 'ACTIVE' ? 'Desactivar' : 'Activar' }}
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>`,
})
export class PoliciesPage {
  private readonly api = inject(PoliciesApi);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(Feedback);
  readonly fields = policyFields;
  readonly editor = viewChild(EditorComponent);
  readonly items = signal<Policy[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly editing = signal(false);
  readonly selected = signal<Policy | null>(null);
  readonly values = signal<Record<string, string>>({});
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async open(policy: Policy | null = null) {
    if (
      this.hasUnsavedChanges() &&
      !(await this.dialogs.confirm(
        'Descartar cambios',
        'Los cambios de la política no se guardarán.',
        'Descartar',
      ))
    )
      return;
    this.selected.set(policy);
    this.values.set(
      policy
        ? Object.fromEntries(Object.entries(policy).map(([key, value]) => [key, String(value)]))
        : {
            minDurationMinutes: '30',
            maxDurationMinutes: '120',
            slotIncrementMinutes: '30',
            minNoticeMinutes: '0',
            maxAdvanceDays: '30',
            cancellationNoticeMinutes: '0',
            approvalRequired: 'false',
            allowCustomerCancel: 'true',
          },
    );
    this.editing.set(true);
  }
  async cancel() {
    if (
      this.hasUnsavedChanges() &&
      !(await this.dialogs.confirm(
        'Descartar cambios',
        'Los cambios de la política no se guardarán.',
        'Descartar',
      ))
    )
      return;
    this.editor()?.markSaved();
    this.editing.set(false);
  }
  async save(v: Record<string, string>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const body = policyBody(v);
      const policy = this.selected();
      if (policy) await firstValueFrom(this.api.update(policy.id, body));
      else await firstValueFrom(this.api.create(body));
      this.editor()?.markSaved();
      this.editing.set(false);
      this.feedback.success();
      await this.load();
    } catch (error) {
      this.error.set(
        error instanceof Error && error.message === 'Invalid duration increment'
          ? {
              status: 0,
              code: 'INVALID_DURATION',
              error:
                'La duración mínima no puede superar la máxima; ambas deben ser múltiplos del incremento.',
              fields: {},
            }
          : apiError(error),
      );
    } finally {
      this.busy.set(false);
    }
  }
  async state(policy: Policy) {
    const active = policy.status === 'ACTIVE';
    if (
      this.busy() ||
      !(await this.dialogs.confirm(
        active ? 'Desactivar política' : 'Activar política',
        active
          ? 'No se puede desactivar una política con asignaciones actuales o futuras.'
          : 'La política podrá asignarse a recursos.',
        active ? 'Desactivar' : 'Activar',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.state(policy.id, active ? 'deactivate' : 'activate'));
      this.feedback.success();
      await this.load();
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  hasUnsavedChanges() {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }
}
