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
import { Session } from '../../core/session';
import { CONFIG } from '../../core/config';
import type { ApiError, Rule, Block, RuleInput } from '../../core/models';
import { apiError } from '../../core/errors';
import { explicitInstant, formatInstant } from '../../core/time';
import { EditorComponent, Field } from '../../shared/editor';
import { ErrorComponent, Feedback, StatusComponent } from '../../shared/feedback';
import { DialogService } from '../../shared/dialog';
import { label, options } from '../../shared/labels';
const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ruleFields: readonly Field[] = [
  {
    key: 'weekday',
    label: 'Día de la semana',
    required: true,
    type: 'select',
    options: weekdays.map((label, value) => ({ value: String(value), label })),
  },
  { key: 'startLocalTime', label: 'Hora de inicio', required: true, type: 'time' },
  {
    key: 'endLocalTime',
    label: 'Hora de fin',
    required: true,
    type: 'time',
    hint: 'Debe ser posterior al inicio. Para la noche, divide el horario por día.',
  },
  { key: 'effectiveFrom', label: 'Vigente desde', type: 'date' },
  { key: 'effectiveTo', label: 'Vigente hasta (inclusive)', type: 'date' },
];
const instantHint =
  'ISO 8601 con zona explícita, por ejemplo 2026-10-08T09:00:00-05:00. No se usa la zona del navegador.';
const blockFields: readonly Field[] = [
  { key: 'startAt', label: 'Inicio con zona horaria', required: true, hint: instantHint },
  { key: 'endAt', label: 'Fin con zona horaria', required: true, hint: instantHint },
  { key: 'reason', label: 'Motivo', required: true, type: 'textarea' },
  {
    key: 'blockType',
    label: 'Tipo de bloqueo',
    required: true,
    type: 'select',
    options: options(['MAINTENANCE', 'CLOSURE', 'ADMIN_BLOCK']),
  },
];
@Component({
  selector: 'app-resource-schedule',
  imports: [EditorComponent, ErrorComponent, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <section class="panel">
    <div class="toolbar">
      <div>
        <h2>Horarios y bloqueos</h2>
        <p>
          Horas de compañía: {{ zone }}. Los bloqueos se ingresan con desplazamiento UTC explícito.
        </p>
      </div>
      <button (click)="load()" [disabled]="busy() || loading()">Actualizar horarios</button>
    </div>
    <app-error [error]="error()" />
    @if (mode()) {
      <h3>{{ mode() === 'rule' ? 'Horario semanal' : 'Bloqueo' }}</h3>
      <app-editor
        id="schedule"
        [fields]="mode() === 'rule' ? ruleFields : blockFields"
        [values]="values()"
        [busy]="busy()"
        (saved)="save($event)"
        (cancelled)="cancel()"
      />
    }
    @if (loading()) {
      <app-status [loading]="true" />
    } @else {
      <div class="toolbar">
        <h3>Horarios semanales</h3>
        @if (session.admin()) {
          <button [disabled]="busy()" (click)="openRule()">Añadir horario</button>
        }
      </div>
      @if (!rules().length) {
        <app-status message="Sin horarios configurados. El recurso no ofrecerá disponibilidad." />
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="sr-only">
              Horarios del recurso
            </caption>
            <thead>
              <tr>
                <th>Día</th>
                <th>Horario local</th>
                <th>Vigencia</th>
                @if (session.admin()) {
                  <th>Acciones</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (rule of rules(); track rule.id) {
                <tr>
                  <td>{{ weekdays[rule.weekday] }}</td>
                  <td>{{ rule.startLocalTime }}–{{ rule.endLocalTime }}</td>
                  <td>
                    {{ rule.effectiveFrom || 'Sin inicio' }} / {{ rule.effectiveTo || 'Sin fin' }}
                  </td>
                  @if (session.admin()) {
                    <td>
                      <div class="actions">
                        <button [disabled]="busy()" (click)="openRule(rule)">Editar</button
                        ><button
                          class="danger"
                          [disabled]="busy()"
                          (click)="remove('rule', rule.id)"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <div class="toolbar">
        <h3>Bloqueos</h3>
        @if (session.admin()) {
          <button [disabled]="busy()" (click)="openBlock()">Añadir bloqueo</button>
        }
      </div>
      @if (!blocks().length) {
        <app-status message="Sin bloqueos registrados." />
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="sr-only">
              Bloqueos del recurso
            </caption>
            <thead>
              <tr>
                <th>Intervalo ({{ zone }})</th>
                <th>Motivo</th>
                <th>Tipo</th>
                @if (session.admin()) {
                  <th>Acciones</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (block of blocks(); track block.id) {
                <tr>
                  <td>{{ instant(block.startAt) }} → {{ instant(block.endAt) }}</td>
                  <td>{{ block.reason }}</td>
                  <td>{{ label(block.blockType) }}</td>
                  @if (session.admin()) {
                    <td>
                      <div class="actions">
                        <button [disabled]="busy()" (click)="openBlock(block)">Editar</button
                        ><button
                          class="danger"
                          [disabled]="busy()"
                          (click)="remove('block', block.id)"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  </section>`,
})
export class ResourceSchedule {
  readonly resourceId = input.required<string>();
  readonly session = inject(Session);
  readonly zone = inject(CONFIG).companyTimezone;
  private readonly api = inject(ResourcesApi);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(Feedback);
  readonly editor = viewChild(EditorComponent);
  readonly ruleFields = ruleFields;
  readonly blockFields = blockFields;
  readonly weekdays = weekdays;
  readonly label = label;
  readonly rules = signal<Rule[]>([]);
  readonly blocks = signal<Block[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly mode = signal<'rule' | 'block' | null>(null);
  readonly selectedId = signal<string | null>(null);
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
  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [rules, blocks] = await Promise.all([
        firstValueFrom(this.api.rules(this.resourceId())),
        firstValueFrom(this.api.blocks(this.resourceId())),
      ]);
      this.rules.set(rules);
      this.blocks.set(blocks);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  private async canReplace() {
    return (
      !this.hasUnsavedChanges() ||
      (await this.dialogs.confirm(
        'Descartar cambios',
        'Los cambios del horario o bloqueo no se guardarán.',
        'Descartar',
      ))
    );
  }
  async openRule(rule: Rule | null = null) {
    if (!(await this.canReplace())) return;
    this.selectedId.set(rule?.id ?? null);
    this.values.set(
      rule
        ? {
            weekday: String(rule.weekday),
            startLocalTime: rule.startLocalTime,
            endLocalTime: rule.endLocalTime,
            effectiveFrom: rule.effectiveFrom ?? '',
            effectiveTo: rule.effectiveTo ?? '',
          }
        : { weekday: '1' },
    );
    this.mode.set('rule');
  }
  async openBlock(block: Block | null = null) {
    if (!(await this.canReplace())) return;
    this.selectedId.set(block?.id ?? null);
    this.values.set(
      block
        ? {
            startAt: block.startAt,
            endAt: block.endAt,
            reason: block.reason,
            blockType: block.blockType,
          }
        : { blockType: 'ADMIN_BLOCK' },
    );
    this.mode.set('block');
  }
  async cancel() {
    if (!(await this.canReplace())) return;
    this.editor()?.markSaved();
    this.mode.set(null);
  }
  async save(v: Record<string, string>) {
    if (this.busy() || !this.session.admin()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      if (this.mode() === 'rule') {
        if (
          v['endLocalTime'] <= v['startLocalTime'] ||
          (v['effectiveFrom'] && v['effectiveTo'] && v['effectiveTo'] < v['effectiveFrom'])
        )
          throw new Error('Invalid interval');
        const body: RuleInput = {
          weekday: Number(v['weekday']),
          startLocalTime: v['startLocalTime'],
          endLocalTime: v['endLocalTime'],
          ...(v['effectiveFrom'] ? { effectiveFrom: v['effectiveFrom'] } : {}),
          ...(v['effectiveTo'] ? { effectiveTo: v['effectiveTo'] } : {}),
        };
        await firstValueFrom(this.api.saveRule(this.resourceId(), this.selectedId(), body));
      } else {
        const startAt = explicitInstant(v['startAt']),
          endAt = explicitInstant(v['endAt']);
        if (Date.parse(endAt) <= Date.parse(startAt)) throw new Error('Invalid interval');
        await firstValueFrom(
          this.api.saveBlock(this.resourceId(), this.selectedId(), {
            startAt,
            endAt,
            reason: v['reason'].trim(),
            blockType: v['blockType'] as Block['blockType'],
          }),
        );
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
                'Revisa el intervalo: el fin debe ser posterior al inicio y los instantes requieren una zona UTC explícita.',
              fields: {},
            }
          : apiError(error),
      );
    } finally {
      this.busy.set(false);
    }
  }
  async remove(kind: 'rule' | 'block', id: string) {
    if (
      this.busy() ||
      !this.session.admin() ||
      !(await this.dialogs.confirm(
        'Eliminar ' + (kind === 'rule' ? 'horario' : 'bloqueo'),
        'El recurso conservará su historial de reservas. Esta configuración dejará de aplicarse.',
        'Eliminar',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        kind === 'rule'
          ? this.api.removeRule(this.resourceId(), id)
          : this.api.removeBlock(this.resourceId(), id),
      );
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
