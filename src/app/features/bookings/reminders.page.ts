import { RouterLink } from '@angular/router';
import { PaginationComponent } from '../../shared/pagination';
import { label } from '../../shared/labels';
import { formatInstant } from '../../core/time';
import { CONFIG } from '../../core/config';
import type { Page } from '../../core/models';
import { Component, inject, signal, viewChild, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import type { ApiError } from '../../core/models';
import { EditorComponent, Field } from '../../shared/editor';
import { ErrorComponent, Feedback } from '../../shared/feedback';
type ReminderDelivery = {
  id: string;
  bookingId: string;
  bookingNumber: number;
  customerName: string;
  startAt: string;
  status: string;
  sentAt: string | null;
};
type Settings = { enabled: boolean; minutesBefore: number };
@Component({
  selector: 'app-reminders-page',
  imports: [RouterLink, PaginationComponent, EditorComponent, ErrorComponent],
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">Compañía / Recordatorios</p>
        <h1 tabindex="-1">Recordatorios de reservas</h1>
        <p>Ayuda a tus clientes a recordar su próxima reserva por correo.</p>
      </div>
    </header>
    <app-error [error]="error()" />
    <section class="panel">
      <h2>Envío automático</h2>
      <p>
        Enviamos un recordatorio por reserva confirmada y horario, al correo de la persona que
        reservó. Las reservas canceladas o reprogramadas dejan de recibir el aviso anterior antes de
        que se inicie su envío.
      </p>
      @if (loading()) {
        <p role="status">Cargando configuración…</p>
      } @else if (settings(); as settings) {
        <app-editor
          id="reminders"
          [fields]="fields"
          [values]="formValues()"
          [busy]="saving()"
          submitLabel="Guardar recordatorios"
          (saved)="save($event)"
          (cancelled)="reset()"
        />
      }
      <p>
        Si activas los recordatorios cuando una reserva ya está dentro de este plazo, su aviso se
        pondrá en cola en la próxima revisión. El envío requiere que el servicio de correo esté
        habilitado.
      </p>
    </section>
    <section class="panel">
      <div class="section-heading">
        <h2>Últimos recordatorios</h2>
        <button [disabled]="historyBusy()" (click)="loadHistory(historyPage())">
          Actualizar historial
        </button>
      </div>
      <p>
        Consulta los avisos de tu compañía y su estado de envío. Los avisos omitidos corresponden a
        reservas que cambiaron o dejaron de requerir el recordatorio.
      </p>
      @if (historyBusy()) {
        <p role="status">Cargando recordatorios…</p>
      } @else {
        <div class="table-wrap">
          <table>
            <caption>
              Historial de recordatorios
            </caption>
            <thead>
              <tr>
                <th>Reserva</th>
                <th>Cliente</th>
                <th>Horario recordado</th>
                <th>Estado</th>
                <th>Enviado</th>
              </tr>
            </thead>
            <tbody>
              @for (delivery of history(); track delivery.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/bookings', delivery.bookingId]"
                      >Reserva #{{ delivery.bookingNumber }}</a
                    >
                  </td>
                  <td>{{ delivery.customerName }}</td>
                  <td>{{ format(delivery.startAt) }}</td>
                  <td>
                    <span class="status-pill" [attr.data-status]="delivery.status">{{
                      label(delivery.status)
                    }}</span>
                  </td>
                  <td>{{ delivery.sentAt ? format(delivery.sentAt) : '—' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    Aún no hay recordatorios registrados. Aparecerán cuando las reservas confirmadas
                    entren en el plazo configurado.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination
          [total]="historyTotal()"
          [page]="historyPage()"
          [size]="20"
          [busy]="historyBusy()"
          (pageChange)="loadHistory($event)"
        />
      }
    </section>`,
})
export class RemindersPage {
  private readonly api = inject(Api);
  private readonly feedback = inject(Feedback);
  readonly editor = viewChild(EditorComponent);
  readonly settings = signal<Settings | null>(null);
  readonly formValues = computed(() => ({
    enabled: this.settings()?.enabled ? 'true' : 'false',
    minutesBefore: String(this.settings()?.minutesBefore ?? 60),
  }));
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly fields: Field[] = [
    {
      key: 'enabled',
      label: 'Recordatorios por correo',
      type: 'select',
      required: true,
      options: [
        { value: 'false', label: 'Desactivados' },
        { value: 'true', label: 'Activados' },
      ],
    },
    {
      key: 'minutesBefore',
      label: 'Anticipación (minutos)',
      type: 'number',
      required: true,
      min: 1,
      max: 10080,
      pattern: '[0-9]+',
      hint: 'Por ejemplo, 60 para una hora o 1440 para un día. Máximo: 7 días.',
    },
  ];
  private readonly config = inject(CONFIG);
  readonly history = signal<ReminderDelivery[]>([]);
  readonly historyTotal = signal(0);
  readonly historyPage = signal(0);
  readonly historyBusy = signal(false);
  readonly label = label;
  readonly format = (value: string) => formatInstant(value, this.config.companyTimezone);
  async loadHistory(page: number) {
    if (this.historyBusy()) return;
    this.historyBusy.set(true);
    try {
      const result = await firstValueFrom(
        this.api.get<Page<ReminderDelivery>>(this.api.companyPath('/reminders/history'), {
          page,
          size: 20,
        }),
      );
      this.history.set(result.items);
      this.historyTotal.set(result.totalElements);
      this.historyPage.set(page);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.historyBusy.set(false);
    }
  }
  constructor() {
    void this.load();
    void this.loadHistory(0);
  }
  hasUnsavedChanges() {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }
  async load() {
    try {
      this.settings.set(
        await firstValueFrom(this.api.get<Settings>(this.api.companyPath('/reminders'))),
      );
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async save(values: Record<string, string>) {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      this.settings.set(
        await firstValueFrom(
          this.api.put<Settings>(this.api.companyPath('/reminders'), {
            enabled: values['enabled'] === 'true',
            minutesBefore: Number(values['minutesBefore']),
          }),
        ),
      );
      this.editor()?.markSaved();
      this.feedback.success('Configuración de recordatorios guardada.');
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.saving.set(false);
    }
  }
  reset() {
    const current = this.settings();
    if (current) this.settings.set({ ...current });
  }
}
