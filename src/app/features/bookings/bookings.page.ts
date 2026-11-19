import { BookingCalendar } from './booking-calendar';
import { PaginationComponent } from '../../shared/pagination';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  const value = localDateStart(date, 'UTC');
  value.setUTCDate(value.getUTCDate() + delta);
  return localDate(value);
}
@Component({
  selector: 'app-bookings-page',
  imports: [BookingCalendar, PaginationComponent, RouterLink, ErrorComponent, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">Compañía / Reservas</p>
        <h1 tabindex="-1">{{ calendar() ? 'Calendario de reservas' : 'Reservas' }}</h1>
        <p>Tu agenda, organizada por recurso y estado. Horas de Bogotá.</p>
      </div>
      <div class="actions booking-header-actions">
        <nav class="view-switcher" aria-label="Vistas de reservas">
          <a
            routerLink="/bookings"
            [queryParams]="viewQuery()"
            [attr.aria-current]="calendar() ? null : 'page'"
            >Lista</a
          >
          <a
            routerLink="/calendar"
            [queryParams]="viewQuery()"
            [attr.aria-current]="calendar() ? 'page' : null"
            >Calendario</a
          >
        </nav>
        <a class="button primary" routerLink="/bookings/new">Nueva reserva</a>
      </div>
    </header>
    <app-error [error]="error()" />
    <section class="panel">
      <details class="agenda-filters" [open]="!calendar()">
        <summary>Filtrar por fecha, recurso o estado</summary>
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
        <div class="toolbar calendar-filters">
          <label for="booking-resource-filter"
            >Recurso<select
              id="booking-resource-filter"
              aria-label="Filtrar por recurso"
              [value]="resourceFilter()"
              (change)="setResourceFilter($event)"
            >
              <option value="">Todos los recursos</option>
              @for (resource of resources(); track resource.id) {
                <option [value]="resource.id">{{ resource.name }}</option>
              }
            </select></label
          >
          <label for="booking-status-filter"
            >Estado<select
              id="booking-status-filter"
              aria-label="Filtrar por estado"
              [value]="statusFilter()"
              (change)="setStatusFilter($event)"
            >
              <option value="">Todos los estados</option>
              @for (status of statuses; track status) {
                <option [value]="status">{{ label(status) }}</option>
              }
            </select></label
          >
        </div>
      </details>
      @if (calendar() && validCalendarRange() && !error()) {
        <app-booking-calendar
          [bookings]="filtered()"
          [resources]="resources()"
          [from]="from()"
          [to]="to()"
          [zone]="zone"
          [busy]="loading()"
          (rangeChange)="calendarRange($event)"
        />
      }
      @if (loading() && !calendar()) {
        <app-status [loading]="true" />
      } @else if (!filtered().length && !calendar()) {
        <app-status [message]="'No hay reservas en este intervalo para tu identidad.'" />
      } @else if (!calendar()) {
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
                    <span class="status-pill" [attr.data-status]="booking.status">{{
                      label(booking.status)
                    }}</span>
                  </td>
                  <td><a [routerLink]="['/bookings', booking.id]">Ver detalle</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination
          [total]="filtered().length"
          [page]="page()"
          [busy]="loading()"
          label="Paginación de reservas"
          (pageChange)="setPage($event)"
        />
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
  readonly page = signal(Math.max(0, Number(this.route.snapshot.queryParamMap.get('page')) || 0));
  readonly label = label;
  readonly statuses = statuses;
  readonly resourceFilter = signal(this.route.snapshot.queryParamMap.get('resourceId') ?? '');
  readonly statusFilter = signal(this.route.snapshot.queryParamMap.get('status') ?? '');
  readonly validCalendarRange = computed(() => {
    try {
      return localDateStart(this.to(), this.zone) >= localDateStart(this.from(), this.zone);
    } catch {
      return false;
    }
  });
  readonly viewQuery = computed(() => ({
    from: this.from(),
    to: this.to(),
    resourceId: this.resourceFilter() || null,
    status: this.statusFilter() || null,
  }));
  readonly format = (value: string) => formatInstant(value, this.zone);
  readonly filtered = computed(() =>
    this.bookings().filter(
      (booking) =>
        (this.session.staff() || booking.customerUserId === this.session.identity()?.userId) &&
        (!this.resourceFilter() || booking.resourceId === this.resourceFilter()) &&
        (!this.statusFilter() || booking.status === this.statusFilter()),
    ),
  );
  readonly ordered = computed(() =>
    [...this.filtered()].sort((a, b) => a.startAt.localeCompare(b.startAt)),
  );
  readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / 10)));
  readonly paged = computed(() => this.ordered().slice(this.page() * 10, this.page() * 10 + 10));
  constructor() {
    void this.load();
  }
  resourceName(id: string): string {
    return this.resources().find((resource) => resource.id === id)?.name ?? id;
  }
  private requestVersion = 0;
  async load() {
    const version = ++this.requestVersion;
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
      if (version !== this.requestVersion) return;
      this.bookings.set(bookings);
      this.resources.set(resources);
      this.page.set(Math.min(this.page(), this.pages() - 1));
    } catch (error) {
      if (version !== this.requestVersion) return;
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
      if (version === this.requestVersion) this.loading.set(false);
    }
  }
  async calendarRange(range: { from: string; to: string }) {
    this.from.set(range.from);
    this.to.set(range.to);
    this.page.set(0);
    await this.updateUrl();
    await this.load();
  }
  setPage(page: number) {
    this.page.set(page);
    void this.updateUrl();
  }
  setResourceFilter(event: Event) {
    this.resourceFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
    void this.updateUrl();
  }
  setStatusFilter(event: Event) {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
    void this.updateUrl();
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
      queryParams: { ...this.viewQuery(), page: this.page() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
@Component({
  selector: 'app-booking-create-page',
  imports: [PaginationComponent, RouterLink, EditorComponent, ErrorComponent, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">Reservas / Crear</p>
        <h1 tabindex="-1">Nueva reserva</h1>
        <p>Elige un recurso y encuentra un horario disponible.</p>
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
        (changed)="updateRequest($event)"
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
            @for (slot of pagedSlots(); track slot.startAt) {
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
        <app-pagination
          [total]="slots().length"
          [page]="slotPage()"
          [size]="12"
          [busy]="loading() || busy()"
          label="Paginación de horarios disponibles"
          (pageChange)="slotPage.set($event)"
        />
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
  readonly slotPage = signal(0);
  readonly pagedSlots = computed(() =>
    this.slots().slice(this.slotPage() * 12, this.slotPage() * 12 + 12),
  );
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
    this.slotPage.set(0);
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
  updateRequest(values: Record<string, string>) {
    if (!this.request) return;
    if (
      ['resourceId', 'date', 'durationMinutes'].some((key) => values[key] !== this.request?.[key])
    ) {
      this.request = null;
      this.slots.set([]);
      this.slotPage.set(0);
      this.queried.set(false);
      return;
    }
    this.request = { ...values };
  }
  async reserve(slot: Slot) {
    if (
      this.busy() ||
      this.loading() ||
      !this.request ||
      !this.slots().some(
        (available) => available.startAt === slot.startAt && available.endAt === slot.endAt,
      )
    )
      return;
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
              <span class="status-pill" [attr.data-status]="item.status">{{
                label(item.status)
              }}</span>
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
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => {
      this.canceling.set(false);
      this.rescheduling.set(false);
      void this.load();
    });
  }
  hasUnsavedChanges(): boolean {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }
  async load() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.booking.set(null);
    this.resource.set(null);
    this.loading.set(true);
    this.error.set(null);
    try {
      const booking = await firstValueFrom(this.api.detail(id));
      const resources = await firstValueFrom(this.api.resources());
      if (id !== this.route.snapshot.paramMap.get('id')) return;
      this.booking.set(booking);
      this.resource.set(resources.find((item) => item.id === booking.resourceId) ?? null);
    } catch (error) {
      if (id === this.route.snapshot.paramMap.get('id')) this.error.set(apiError(error));
    } finally {
      if (id === this.route.snapshot.paramMap.get('id')) this.loading.set(false);
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
