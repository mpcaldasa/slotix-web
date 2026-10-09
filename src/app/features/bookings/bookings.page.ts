import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CONFIG } from '../../core/config';
import { Session } from '../../core/session';
import { dateInZone, explicitInstant, formatInstant, localDateStart } from '../../core/time';
import { apiError } from '../../core/errors';
import type { ApiError, Booking, Resource, Slot } from '../../core/models';
import { DialogService } from '../../shared/dialog';
import { EditorComponent, Field, UUID_PATTERN } from '../../shared/editor';
import { ErrorComponent, Feedback, StatusComponent } from '../../shared/feedback';
import { label, options } from '../../shared/labels';
import { BookingsApi } from './bookings-api';
const statuses = [
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'CHECKED_IN',
  'COMPLETED',
  'EXPIRED',
  'NO_SHOW',
] as const;
function localDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}
function dateOffset(date: string, delta: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return localDate(value);
}
@Component({
  selector: 'app-bookings-page',
  imports: [RouterLink, ErrorComponent, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">Compañía / Reservas</p>
        <h1 tabindex="-1">{{ calendar() ? 'Calendario de reservas' : 'Reservas' }}</h1>
        <p>Fechas y horas en {{ zone }}. El servidor define los estados y permisos vigentes.</p>
      </div>
      <div class="actions">
        <a routerLink="/bookings">Lista</a><a routerLink="/calendar">Calendario</a
        ><a class="button primary" routerLink="/bookings/new">Nueva reserva</a>
      </div>
    </header>
    <app-error [error]="error()" />
    <section class="panel">
      <div class="toolbar">
        <label for="bookings-from"
          >Desde<input
            id="bookings-from"
            type="date"
            [value]="from()"
            (change)="setFrom($event)" /></label
        ><label for="bookings-to"
          >Hasta<input
            id="bookings-to"
            type="date"
            [value]="to()"
            (change)="setTo($event)" /></label
        ><button [disabled]="loading()" (click)="load()">Actualizar</button>
      </div>
      @if (loading()) {
        <app-status [loading]="true" />
      } @else if (!filtered().length) {
        <app-status [message]="'No hay reservas en este intervalo para tu identidad.'" />
      } @else {
        @if (calendar()) {
          <div class="table-wrap">
            <table class="calendar-table">
              <caption>
                Agenda accesible ·
                {{
                  from()
                }}
                a
                {{
                  to()
                }}
                ·
                {{
                  zone
                }}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Inicio</th>
                  <th scope="col">Reserva</th>
                  <th scope="col">Recurso</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (booking of ordered(); track booking.id) {
                  <tr>
                    <td>{{ format(booking.startAt) }}</td>
                    <td>
                      <a [routerLink]="['/bookings', booking.id]"
                        >Reserva {{ booking.bookingNumber ? booking.bookingNumber : booking.id }}</a
                      ><small>{{ format(booking.endAt) }}</small>
                    </td>
                    <td>{{ resourceName(booking.resourceId) }}</td>
                    <td>
                      <span class="status-pill">{{ label(booking.status) }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="table-wrap">
            <table>
              <caption>
                Reservas ·
                {{
                  filtered().length
                }}
                resultados (máximo 31 días)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Reserva</th>
                  <th scope="col">Fecha y hora ({{ zone }})</th>
                  <th scope="col">Recurso</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (booking of paged(); track booking.id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/bookings', booking.id]">{{
                        booking.bookingNumber ? '#' + booking.bookingNumber : booking.id
                      }}</a>
                    </td>
                    <td>
                      {{ format(booking.startAt) }}<small>Hasta {{ format(booking.endAt) }}</small>
                    </td>
                    <td>{{ resourceName(booking.resourceId) }}</td>
                    <td>
                      <span class="status-pill">{{ label(booking.status) }}</span>
                    </td>
                    <td><a [routerLink]="['/bookings', booking.id]">Ver detalle</a></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <nav class="actions" aria-label="Paginación de reservas">
            <button [disabled]="page() === 0" (click)="page.update((v) => v - 1)">Anterior</button
            ><span>Página {{ page() + 1 }} de {{ pages() }}</span
            ><button [disabled]="page() + 1 >= pages()" (click)="page.update((v) => v + 1)">
              Siguiente
            </button>
          </nav>
        }
      }
    </section>`,
})
export class BookingsPage {
  private readonly api = inject(BookingsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly config = inject(CONFIG);
  readonly zone = this.config.companyTimezone;
  readonly calendar = signal(this.route.snapshot.data['calendar'] === true);
  readonly from = signal(this.route.snapshot.queryParamMap.get('from') ?? localDate(new Date()));
  readonly to = signal(
    this.route.snapshot.queryParamMap.get('to') ?? dateOffset(localDate(new Date()), 6),
  );
  readonly bookings = signal<Booking[]>([]);
  readonly resources = signal<Resource[]>([]);
  readonly loading = signal(true);
  readonly error = signal<ApiError | null>(null);
  readonly page = signal(0);
  readonly label = label;
  readonly format = (value: string) => formatInstant(value, this.zone);
  readonly filtered = computed(() =>
    this.bookings().filter(
      (booking) =>
        this.session.staff() || booking.customerUserId === this.session.identity()?.userId,
    ),
  );
  readonly ordered = computed(() =>
    [...this.filtered()].sort((a, b) => a.startAt.localeCompare(b.startAt)),
  );
  readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / 20)));
  readonly paged = computed(() => this.ordered().slice(this.page() * 20, this.page() * 20 + 20));
  constructor() {
    void this.load();
  }
  resourceName(id: string): string {
    return this.resources().find((resource) => resource.id === id)?.name ?? id;
  }
  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const end = localDateStart(dateOffset(this.to(), 1), this.zone);
      const start = localDateStart(this.from(), this.zone);
      if (
        !Number.isFinite(end.valueOf()) ||
        !Number.isFinite(start.valueOf()) ||
        end <= start ||
        Math.ceil((end.getTime() - start.getTime()) / 86400000) > 31
      )
        throw new Error('invalid-date-range');
      if (!this.session.identity()) return;
      const bookingsRequest = this.api.list(
        start.toISOString(),
        end.toISOString(),
        this.calendar(),
      );
      const resourcesRequest = this.api.resources();
      const [bookings, resources] = await Promise.all([
        firstValueFrom(bookingsRequest),
        firstValueFrom(resourcesRequest),
      ]);
      this.bookings.set(bookings);
      this.resources.set(resources);
      this.page.set(Math.min(this.page(), this.pages() - 1));
    } catch (error) {
      this.error.set(
        error instanceof Error && error.message === 'invalid-date-range'
          ? {
              status: 400,
              code: 'CALENDAR_RANGE_INVALID',
              error: 'El rango debe ser positivo y no superar 31 días.',
              fields: {},
            }
          : apiError(error),
      );
    } finally {
      this.loading.set(false);
    }
  }
  setFrom(event: Event) {
    this.from.set((event.target as HTMLInputElement).value);
    this.page.set(0);
    void this.updateUrl();
  }
  setTo(event: Event) {
    this.to.set((event.target as HTMLInputElement).value);
    this.page.set(0);
    void this.updateUrl();
  }
  updateUrl() {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: this.from(), to: this.to() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
@Component({
  selector: 'app-booking-create-page',
  imports: [RouterLink, EditorComponent, ErrorComponent, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">Reservas / Crear</p>
        <h1 tabindex="-1">Nueva reserva</h1>
        <p>La disponibilidad del servidor determina los horarios reservables.</p>
      </div>
      <a routerLink="/bookings">Volver a reservas</a>
    </header>
    <app-error [error]="error()" />
    <section class="panel">
      <h2>Encuentra un horario</h2>
      <app-editor
        id="availability"
        [fields]="fields"
        [values]="defaults"
        [busy]="loading() || busy()"
        submitLabel="Consultar disponibilidad"
        (saved)="search($event)"
        (cancelled)="cancel()"
      />
    </section>
    @if (loading()) {
      <app-status [loading]="true" />
    }
    @if (queried() && !loading()) {
      <section class="panel">
        <h2>Horarios disponibles</h2>
        <p>
          Los horarios usan {{ zone }}. Se envían al servidor los instantes exactos devueltos por
          disponibilidad.
        </p>
        @if (!slots().length) {
          <app-status message="No hay horarios disponibles. Elige otra fecha o recurso." />
        } @else {
          <ul class="slot-list">
            @for (slot of slots(); track slot.startAt) {
              <li>
                <button [disabled]="busy()" (click)="reserve(slot)">
                  <strong>{{ format(slot.startAt) }}</strong
                  ><span>hasta {{ format(slot.endAt) }}</span
                  ><span class="visually-hidden">Reservar este horario</span>
                </button>
              </li>
            }
          </ul>
        }
      </section>
    }`,
})
export class BookingCreatePage {
  private readonly api = inject(BookingsApi);
  private readonly session = inject(Session);
  private readonly config = inject(CONFIG);
  private readonly router = inject(Router);
  private readonly feedback = inject(Feedback);
  private readonly dialogs = inject(DialogService);
  readonly zone = this.config.companyTimezone;
  readonly fields: Field[] = [
    { key: 'resourceId', label: 'Recurso', type: 'select', required: true, options: [] },
    { key: 'date', label: 'Fecha en ' + this.config.companyTimezone, type: 'date', required: true },
    {
      key: 'durationMinutes',
      label: 'Duración (minutos)',
      type: 'number',
      required: true,
      min: 1,
      max: 1440,
      pattern: '[0-9]+',
    },
    ...(this.session.staff()
      ? [
          {
            key: 'customerUserId',
            label: 'ID de cliente (opcional)',
            pattern: UUID_PATTERN,
            hint: 'Usa un identificador conocido; el backend no ofrece búsqueda de miembros para gestores.',
          } as Field,
        ]
      : []),
    { key: 'notes', label: 'Notas para la reserva', type: 'textarea', maxLength: 2000 },
  ];
  readonly editor = viewChild(EditorComponent);
  readonly defaults = {
    date: dateInZone(new Date().toISOString(), this.zone),
    durationMinutes: '60',
  };
  readonly resources = signal<Resource[]>([]);
  readonly slots = signal<Slot[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly queried = signal(false);
  readonly error = signal<ApiError | null>(null);
  private request: Record<string, string> | null = null;
  private idempotencyKey = '';
  private idempotencyPayload = '';
  constructor() {
    void this.loadResources();
  }
  readonly format = (instant: string) => formatInstant(instant, this.zone);
  hasUnsavedChanges(): boolean {
    return (this.editor()?.hasUnsavedChanges() ?? false) || this.queried();
  }
  async loadResources() {
    try {
      this.resources.set(await firstValueFrom(this.api.resources()));
      const field = this.fields.find((item) => item.key === 'resourceId');
      if (field)
        field.options = this.resources()
          .filter((item) => item.status === 'ACTIVE')
          .map((item) => ({ value: item.id, label: `${item.name} · ${label(item.resourceType)}` }));
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async search(values: Record<string, string>) {
    const resource = this.resources().find(
      (item) => item.id === values['resourceId'] && item.status === 'ACTIVE',
    );
    const duration = Number(values['durationMinutes']);
    if (
      !resource ||
      !values['date'] ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 1440
    ) {
      this.error.set({
        status: 422,
        code: 'VALIDATION_FAILED',
        error: 'Selecciona un recurso activo, una fecha y una duración válida.',
        fields: {},
      });
      return;
    }
    this.request = { ...values };
    this.slots.set([]);
    this.queried.set(true);
    this.loading.set(true);
    this.error.set(null);
    try {
      this.slots.set(
        await firstValueFrom(this.api.availability(resource.id, values['date'], duration)),
      );
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async reserve(slot: Slot) {
    if (this.busy() || !this.request) return;
    const resourceId = this.request['resourceId'];
    const input = {
      resourceId,
      startAt: slot.startAt,
      endAt: slot.endAt,
      ...(this.session.staff() && this.request['customerUserId']
        ? { customerUserId: this.request['customerUserId'] }
        : {}),
      ...(this.request['notes'] ? { notes: this.request['notes'] } : {}),
    };
    const payload = JSON.stringify(input);
    if (payload !== this.idempotencyPayload) {
      this.idempotencyKey = '';
      this.idempotencyPayload = payload;
    }
    if (!this.idempotencyKey) this.idempotencyKey = crypto.randomUUID();
    this.busy.set(true);
    this.error.set(null);
    try {
      const booking = await firstValueFrom(this.api.create(input, this.idempotencyKey));
      this.idempotencyKey = '';
      this.idempotencyPayload = '';
      this.editor()?.markSaved();
      this.queried.set(false);
      this.feedback.success('Reserva creada.');
      await this.router.navigate(['/bookings', booking.id]);
    } catch (error) {
      const issue = apiError(error);
      this.error.set(issue);
      if (issue.code === 'BOOKING_SLOT_UNAVAILABLE') {
        this.slots.set([]);
        this.queried.set(false);
        await this.dialogs.confirm(
          'Horario ocupado',
          'Otra reserva tomó este horario. Consulta nuevamente para recibir disponibilidad actualizada.',
          'Entendido',
        );
        await this.search(this.request);
      }
    } finally {
      this.busy.set(false);
    }
  }
  async cancel() {
    if (
      this.request &&
      !(await this.dialogs.confirm(
        'Salir de la reserva',
        'Los horarios consultados no se guardarán.',
        'Salir',
      ))
    )
      return;
    this.editor()?.markSaved();
    this.queried.set(false);
    await this.router.navigateByUrl('/bookings');
  }
}
@Component({
  selector: 'app-booking-detail-page',
  imports: [RouterLink, EditorComponent, ErrorComponent, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">Reservas / Detalle</p>
        <h1 tabindex="-1">
          {{
            booking()?.bookingNumber ? 'Reserva #' + booking()?.bookingNumber : 'Detalle de reserva'
          }}
        </h1>
        <p>Fecha en {{ booking()?.timezone || zone }}</p>
      </div>
      <a routerLink="/bookings">Volver a reservas</a>
    </header>
    <app-error [error]="error()" />
    @if (loading()) {
      <app-status [loading]="true" />
    }
    @if (booking(); as item) {
      <section class="panel">
        <dl class="detail-grid">
          <div>
            <dt>Estado</dt>
            <dd>
              <span class="status-pill">{{ label(item.status) }}</span>
            </dd>
          </div>
          <div>
            <dt>Recurso</dt>
            <dd>{{ resourceName() }}</dd>
          </div>
          <div>
            <dt>Inicio</dt>
            <dd>{{ format(item.startAt, item.timezone) }}</dd>
          </div>
          <div>
            <dt>Fin</dt>
            <dd>{{ format(item.endAt, item.timezone) }}</dd>
          </div>
          <div>
            <dt>Cliente</dt>
            <dd>{{ item.customerUserId }}</dd>
          </div>
          <div>
            <dt>Notas</dt>
            <dd>{{ item.notes || 'Sin notas' }}</dd>
          </div>
          @if (item.cancellationReason) {
            <div>
              <dt>Motivo de cancelación</dt>
              <dd>{{ item.cancellationReason }}</dd>
            </div>
          }
        </dl>
        @if (canceling()) {
          <h2>Cancelar reserva</h2>
          <app-editor
            [fields]="cancelFields"
            [busy]="busy()"
            submitLabel="Confirmar cancelación"
            (saved)="cancel($event)"
            (cancelled)="canceling.set(false)"
          />
        }
        @if (rescheduling()) {
          <h2>Reprogramar reserva</h2>
          <p>
            Ingresa hora local con offset explícito, por ejemplo 2026-10-09T09:30:00-05:00. El
            servidor validará política, disponibilidad y propiedad.
          </p>
          <app-editor
            [fields]="rescheduleFields"
            [busy]="busy()"
            submitLabel="Consultar y guardar horario"
            (saved)="reschedule($event)"
            (cancelled)="rescheduling.set(false)"
          />
        }
        <div class="actions">
          @if (
            (item.status === 'PENDING' || item.status === 'CONFIRMED') &&
            session.has('COMPANY_ADMIN', 'BOOKING_MANAGER')
          ) {
            <button
              [disabled]="busy()"
              (click)="action(item.status === 'PENDING' ? 'approve' : 'check-in')"
            >
              {{ item.status === 'PENDING' ? 'Aprobar' : 'Registrar ingreso' }}
            </button>
          }
          @if (item.status === 'PENDING' && session.has('COMPANY_ADMIN', 'BOOKING_MANAGER')) {
            <button [disabled]="busy()" (click)="action('reject')">Rechazar</button>
          }
          @if (item.status === 'CHECKED_IN' && session.staff()) {
            <button [disabled]="busy()" (click)="action('complete')">Finalizar uso</button>
          }
          @if (item.status === 'CONFIRMED' && session.staff()) {
            <button [disabled]="busy()" (click)="action('no-show')">Marcar ausencia</button>
          }
          @if (['PENDING', 'CONFIRMED'].includes(item.status)) {
            <button [disabled]="busy()" (click)="canceling.set(true)">Cancelar</button
            ><button [disabled]="busy()" (click)="rescheduling.set(true)">Reprogramar</button>
          }
        </div>
      </section>
    }`,
})
export class BookingDetailPage {
  private readonly api = inject(BookingsApi);
  private readonly route = inject(ActivatedRoute);
  readonly session = inject(Session);
  private readonly config = inject(CONFIG);
  private readonly feedback = inject(Feedback);
  private readonly dialog = inject(DialogService);
  readonly zone = this.config.companyTimezone;
  readonly label = label;
  readonly booking = signal<Booking | null>(null);
  readonly resource = signal<Resource | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly canceling = signal(false);
  readonly rescheduling = signal(false);
  readonly editor = viewChild(EditorComponent);
  readonly cancelFields: Field[] = [
    {
      key: 'reason',
      label: 'Motivo',
      type: 'textarea',
      required: false,
      maxLength: 1000,
      hint: 'Obligatorio para administradores y gestores.',
    },
  ];
  readonly rescheduleFields: Field[] = [
    {
      key: 'startAt',
      label: 'Nuevo inicio con offset',
      required: true,
      hint: 'Formato ISO-8601 con Z o ±HH:MM.',
    },
    {
      key: 'endAt',
      label: 'Nuevo fin con offset',
      required: true,
      hint: 'Duración máxima 24 horas.',
    },
  ];
  constructor() {
    void this.load();
  }
  hasUnsavedChanges(): boolean {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }
  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const booking = await firstValueFrom(
        this.api.detail(this.route.snapshot.paramMap.get('id') ?? ''),
      );
      this.booking.set(booking);
      this.resource.set(
        (await firstValueFrom(this.api.resources())).find(
          (item) => item.id === booking.resourceId,
        ) ?? null,
      );
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  resourceName() {
    return this.resource()?.name ?? this.booking()?.resourceId ?? '—';
  }
  format(value: string, zone: string) {
    return formatInstant(value, zone || this.zone);
  }
  async action(action: 'approve' | 'reject' | 'check-in' | 'complete' | 'no-show') {
    const item = this.booking();
    if (!item || this.busy()) return;
    if (
      ['reject', 'no-show'].includes(action) &&
      !(await this.dialog.confirm(
        action === 'reject' ? 'Rechazar reserva' : 'Marcar inasistencia',
        `Se actualizará la reserva ${item.bookingNumber ?? item.id}.`,
        'Continuar',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.booking.set(await firstValueFrom(this.api.action(item.id, action)));
      this.feedback.success('Estado de la reserva actualizado.');
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async cancel(values: Record<string, string>) {
    const item = this.booking();
    if (!item || this.busy()) return;
    if (
      !(await this.dialog.confirm(
        'Cancelar reserva',
        `La reserva ${item.bookingNumber ?? item.id} dejará de ocupar el horario. El servidor validará las reglas de cancelación.`,
        'Cancelar reserva',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.booking.set(
        await firstValueFrom(this.api.cancel(item.id, values['reason'] || undefined)),
      );
      this.canceling.set(false);
      this.feedback.success('Reserva cancelada.');
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async reschedule(values: Record<string, string>) {
    const item = this.booking();
    if (!item || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.booking.set(
        await firstValueFrom(
          this.api.reschedule(
            item.id,
            explicitInstant(values['startAt']),
            explicitInstant(values['endAt']),
          ),
        ),
      );
      this.rescheduling.set(false);
      this.feedback.success('Reserva reprogramada.');
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
