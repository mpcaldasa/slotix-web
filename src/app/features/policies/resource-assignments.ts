import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ResourcesApi } from '../resources/resources-api';
import { PoliciesApi } from './policies-api';
import { Session } from '../../core/session';
import { CONFIG } from '../../core/config';
import type { ApiError, Assignment, Policy } from '../../core/models';
import { apiError } from '../../core/errors';
import { explicitInstant, formatInstant } from '../../core/time';
import { EditorComponent, Field } from '../../shared/editor';
import { ErrorComponent, Feedback, StatusComponent } from '../../shared/feedback';
import { DialogService } from '../../shared/dialog';
type Mode = 'assign' | 'replace' | 'close';
@Component({
  selector: 'app-resource-assignments',
  imports: [EditorComponent, ErrorComponent, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <section class="panel">
    <div class="toolbar">
      <div>
        <h2>Políticas asignadas</h2>
        <p>Intervalos en {{ zone }}. Los cambios se validan contra las reservas existentes.</p>
      </div>
      @if (session.admin()) {
        <button [disabled]="busy() || loading()" (click)="open('assign')">Asignar política</button>
      }
    </div>
    <app-error [error]="error()" />
    @if (mode()) {
      <h3>{{ title() }}</h3>
      <p>Ingresa instantes ISO 8601 con offset explícito, por ejemplo 2026-10-09T09:00:00-05:00.</p>
      @if (selected(); as assignment) {
        <p>
          Asignación desde {{ instant(assignment.effectiveFrom) }}. Su identificador original se
          conserva al actualizar.
        </p>
      }
      <app-editor
        id="assignment"
        [fields]="fields()"
        [values]="values()"
        [busy]="busy()"
        (saved)="save($event)"
        (cancelled)="cancel()"
      />
    }
    @if (loading()) {
      <app-status [loading]="true" />
    } @else if (!items().length) {
      <app-status
        message="Sin políticas asignadas. Las reservas requieren una política activa vigente."
      />
    } @else {
      <div class="table-wrap">
        <table>
          <caption class="sr-only">
            Historial de asignaciones de políticas
          </caption>
          <thead>
            <tr>
              <th>Política</th>
              <th>Desde ({{ zone }})</th>
              <th>Hasta</th>
              @if (session.admin()) {
                <th>Acciones</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (assignment of items(); track assignment.effectiveFrom) {
              <tr>
                <td>{{ policyName(assignment.policyId) }}</td>
                <td>{{ instant(assignment.effectiveFrom) }}</td>
                <td>
                  {{ assignment.effectiveTo ? instant(assignment.effectiveTo) : 'Sin cierre' }}
                </td>
                @if (session.admin()) {
                  <td>
                    <div class="actions">
                      @if (isEditable(assignment)) {
                        <button [disabled]="busy()" (click)="open('replace', assignment)">
                          Sustituir política</button
                        ><button [disabled]="busy()" (click)="open('close', assignment)">
                          Acortar vigencia
                        </button>
                      }
                      @if (isFuture(assignment)) {
                        <button class="danger" [disabled]="busy()" (click)="remove(assignment)">
                          Eliminar asignación futura
                        </button>
                      }
                    </div>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    <button [disabled]="busy() || loading()" (click)="load()">Actualizar asignaciones</button>
  </section>`,
})
export class ResourceAssignments {
  readonly resourceId = input.required<string>();
  readonly session = inject(Session);
  readonly zone = inject(CONFIG).companyTimezone;
  private readonly api = inject(ResourcesApi);
  private readonly policiesApi = inject(PoliciesApi);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(Feedback);
  readonly editor = viewChild(EditorComponent);
  readonly items = signal<Assignment[]>([]);
  readonly policies = signal<Policy[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly mode = signal<Mode | null>(null);
  readonly selected = signal<Assignment | null>(null);
  readonly fields = signal<readonly Field[]>([]);
  readonly values = signal<Record<string, string>>({});
  constructor() {
    effect(() => {
      this.resourceId();
      void this.load();
    });
  }
  instant(value: string) {
    return formatInstant(value, this.zone);
  }
  policyName(id: string) {
    return this.policies().find((policy) => policy.id === id)?.name ?? id;
  }
  isFuture(assignment: Assignment) {
    return Date.parse(assignment.effectiveFrom) > Date.now();
  }
  isEditable(assignment: Assignment) {
    return !assignment.effectiveTo || Date.parse(assignment.effectiveTo) > Date.now();
  }
  title() {
    return this.mode() === 'assign'
      ? 'Asignar política'
      : this.mode() === 'replace'
        ? 'Sustituir política'
        : 'Acortar vigencia de asignación';
  }
  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [items, policies] = await Promise.all([
        firstValueFrom(this.api.assignments(this.resourceId())),
        this.session.admin() ? firstValueFrom(this.policiesApi.list()) : Promise.resolve([]),
      ]);
      this.items.set(items);
      this.policies.set(policies);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async open(mode: Mode, assignment: Assignment | null = null) {
    if (!this.session.admin() || !(await this.canReplace())) return;
    this.mode.set(mode);
    this.selected.set(assignment);
    const policyField: Field = {
      key: 'policyId',
      label: 'Política activa',
      required: true,
      type: 'select',
      options: this.policies()
        .filter((policy) => policy.status === 'ACTIVE')
        .map((policy) => ({ value: policy.id, label: policy.name })),
    };
    this.fields.set(
      mode === 'assign'
        ? [
            policyField,
            { key: 'effectiveFrom', label: 'Vigente desde (offset explícito)', required: true },
            { key: 'effectiveTo', label: 'Vigente hasta (opcional, offset explícito)' },
          ]
        : mode === 'replace'
          ? [policyField]
          : [
              {
                key: 'effectiveTo',
                label: 'Nuevo fin (offset explícito)',
                required: true,
                hint: 'Debe ser anterior al fin actual y posterior al inicio.',
              },
            ],
    );
    this.values.set(mode === 'replace' ? { policyId: assignment?.policyId ?? '' } : {});
  }
  private async canReplace() {
    return (
      !this.hasUnsavedChanges() ||
      (await this.dialogs.confirm(
        'Descartar cambios',
        'Los cambios de la asignación no se guardarán.',
        'Descartar',
      ))
    );
  }
  async cancel() {
    if (!(await this.canReplace())) return;
    this.editor()?.markSaved();
    this.mode.set(null);
  }
  async save(v: Record<string, string>) {
    if (this.busy() || !this.session.admin()) return;
    const mode = this.mode();
    const selected = this.selected();
    if (!mode) return;
    if (
      mode !== 'assign' &&
      !(await this.dialogs.confirm(
        this.title(),
        'El servidor rechazará cambios incompatibles con reservas activas. Revisa la nueva vigencia o política antes de confirmar.',
        'Confirmar',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (mode === 'assign') {
        const effectiveFrom = explicitInstant(v['effectiveFrom']);
        const effectiveTo = v['effectiveTo'] ? explicitInstant(v['effectiveTo']) : null;
        if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom))
          throw new Error('Invalid interval');
        await firstValueFrom(
          this.api.assign(this.resourceId(), {
            policyId: v['policyId'],
            effectiveFrom,
            effectiveTo,
          }),
        );
      } else if (selected && mode === 'replace') {
        await firstValueFrom(
          this.api.replace(this.resourceId(), selected.effectiveFrom, v['policyId']),
        );
      } else if (selected) {
        const end = explicitInstant(v['effectiveTo']);
        if (
          Date.parse(end) <= Date.parse(selected.effectiveFrom) ||
          (selected.effectiveTo && Date.parse(end) >= Date.parse(selected.effectiveTo))
        )
          throw new Error('Invalid interval');
        await firstValueFrom(this.api.close(this.resourceId(), selected.effectiveFrom, end));
      }
      this.editor()?.markSaved();
      this.mode.set(null);
      this.feedback.success();
      await this.load();
    } catch (error) {
      this.error.set(
        error instanceof Error &&
          ['Invalid interval', 'An explicit UTC offset is required'].includes(error.message)
          ? {
              status: 0,
              code: 'INVALID_INTERVAL',
              error:
                'El intervalo debe ser válido, con un fin posterior al inicio y offset UTC explícito. El cierre solo puede acortar la vigencia.',
              fields: {},
            }
          : apiError(error),
      );
    } finally {
      this.busy.set(false);
    }
  }
  async remove(assignment: Assignment) {
    if (
      this.busy() ||
      !this.session.admin() ||
      !this.isFuture(assignment) ||
      !(await this.dialogs.confirm(
        'Eliminar asignación futura',
        'La política dejará de aplicarse en este intervalo. Las reservas activas pueden impedir eliminarla.',
        'Eliminar asignación',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.removeAssignment(this.resourceId(), assignment.effectiveFrom));
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
