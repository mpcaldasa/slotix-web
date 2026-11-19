import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Booking, Resource } from '../../core/models';
import { dateInZone, formatInstant } from '../../core/time';
import { label } from '../../shared/labels';
import { calendarDate, calendarEvents, denseCalendarGroups } from './calendar-layout';

@Component({
  selector: 'app-booking-calendar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="booking-calendar" aria-label="Calendario de reservas por hora">
      <div class="calendar-toolbar">
        <div class="actions">
          <button aria-label="Período anterior" [disabled]="busy()" (click)="move(-days().length)">
            ‹ Anterior
          </button>
          <button [disabled]="busy()" (click)="today()">Hoy</button>
          <button aria-label="Período siguiente" [disabled]="busy()" (click)="move(days().length)">
            Siguiente ›
          </button>
        </div>
        <h2 aria-live="polite">{{ heading() }}</h2>
        <div class="view-switcher" role="group" aria-label="Tamaño del calendario">
          <button
            [disabled]="busy()"
            [attr.aria-pressed]="mode() === 'day'"
            (click)="changeMode('day')"
          >
            Día
          </button>
          <button
            [disabled]="busy()"
            [attr.aria-pressed]="mode() === 'week'"
            (click)="changeMode('week')"
          >
            Semana
          </button>
        </div>
      </div>
      <div class="calendar-legend" aria-label="Colores de estado">
        @for (status of states; track status) {
          <span class="calendar-key" [attr.data-status]="status"
            ><i aria-hidden="true"></i>{{ label(status) }}</span
          >
        }
      </div>
      <p class="muted">
        @if (busy()) {
          Actualizando agenda…
        } @else {
          {{ visibleCount() }} {{ visibleCount() === 1 ? 'reserva' : 'reservas' }} en pantalla
        }
        · Horas de Bogotá. Selecciona una reserva para ver su detalle.
      </p>
      <div
        class="calendar-scroll"
        tabindex="0"
        role="region"
        aria-label="Agenda por días y horas, desplazable"
        [attr.aria-busy]="busy()"
      >
        <div
          class="calendar-columns"
          [class.single-day]="mode() === 'day'"
          [style.grid-template-columns]="'64px repeat(' + days().length + ', minmax(120px, 1fr))'"
        >
          <div class="calendar-day-heading calendar-time-heading">Hora</div>
          @for (day of days(); track day.date) {
            <button
              type="button"
              [disabled]="busy()"
              (click)="openDay(day.date)"
              [attr.aria-label]="'Ver día ' + day.date"
              class="calendar-day-heading"
              [class.is-today]="day.date === currentDate"
            >
              <span>{{ weekday(day.date) }}</span
              ><strong>{{ dayNumber(day.date) }}</strong>
              <small
                >{{ day.events.length }}
                {{ day.events.length === 1 ? 'reserva' : 'reservas' }}</small
              >
            </button>
          }
          <div class="calendar-times" [style.height.px]="height()">
            @for (hour of hours(); track hour) {
              <span [style.top.px]="(hour - firstHour()) * 96"
                >{{ hour.toString().padStart(2, '0') }}:00</span
              >
            }
          </div>
          @for (day of days(); track day.date) {
            <div
              class="calendar-day"
              role="group"
              [attr.aria-label]="weekday(day.date) + ' ' + day.date"
              [style.height.px]="height()"
            >
              @if (mode() === 'week') {
                @for (group of day.dense; track group.start) {
                  <button
                    class="calendar-cluster"
                    [disabled]="busy()"
                    (click)="openDay(day.date)"
                    [style.top.px]="((group.start - firstHour() * 60) * 96) / 60"
                    [style.height.px]="((group.end - group.start) * 96) / 60"
                    [attr.aria-label]="
                      group.events.length + ' reservas superpuestas. Ver día ' + day.date
                    "
                  >
                    <strong>{{ time(group.events[0].booking.startAt) }}</strong>
                    <span>{{ group.events.length }} reservas</span><small>Ver día</small>
                    <span class="cluster-colors" aria-hidden="true">
                      @for (event of group.events; track event.booking.id) {
                        <i class="calendar-key" [attr.data-status]="event.booking.status"></i>
                      }
                    </span>
                  </button>
                }
              }
              @for (event of day.events; track event.booking.id) {
                @if (mode() === 'day' || event.lanes <= 2) {
                  <a
                    class="calendar-event"
                    [routerLink]="['/bookings', event.booking.id]"
                    [attr.data-status]="event.booking.status"
                    [attr.aria-label]="eventLabel(event.booking)"
                    [title]="eventLabel(event.booking)"
                    [style.top.px]="((event.start - firstHour() * 60) * 96) / 60"
                    [style.height.px]="((event.end - event.start) * 96) / 60"
                    [style.left.%]="(event.lane * 100) / event.lanes"
                    [style.width]="'calc(' + 100 / event.lanes + '% - 6px)'"
                  >
                    <strong
                      >{{ time(event.booking.startAt) }}–{{ time(event.booking.endAt) }}</strong
                    >
                    <span>{{ resourceName(event.booking.resourceId) }}</span>
                    <small
                      >#{{ event.booking.bookingNumber }} · {{ label(event.booking.status) }}</small
                    >
                  </a>
                }
              }
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class BookingCalendar {
  readonly bookings = input.required<Booking[]>();
  readonly resources = input.required<Resource[]>();
  readonly from = input.required<string>();
  readonly zone = input('America/Bogota');
  readonly busy = input(false);
  readonly rangeChange = output<{ from: string; to: string }>();
  readonly to = input.required<string>();
  readonly mode = computed(() => (this.from() === this.to() ? 'day' : 'week'));
  readonly label = label;
  readonly states = [
    'PENDING',
    'CONFIRMED',
    'CHECKED_IN',
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
    'EXPIRED',
    'NO_SHOW',
  ];
  readonly currentDate = dateInZone(new Date().toISOString(), this.zone());
  readonly days = computed(() =>
    Array.from(
      {
        length: Math.max(
          1,
          Math.min(7, Math.round((Date.parse(this.to()) - Date.parse(this.from())) / 86400000) + 1),
        ),
      },
      (_, offset) => {
        const date = calendarDate(this.from(), offset);
        const events = calendarEvents(this.bookings(), date, this.zone());
        return { date, events, dense: denseCalendarGroups(events) };
      },
    ),
  );
  readonly visibleCount = computed(
    () => new Set(this.days().flatMap((day) => day.events.map((event) => event.booking.id))).size,
  );
  readonly firstHour = computed(() =>
    Math.min(
      8,
      ...this.days().flatMap((day) => day.events.map((event) => Math.floor(event.start / 60))),
    ),
  );
  readonly lastHour = computed(() =>
    Math.max(
      20,
      ...this.days().flatMap((day) => day.events.map((event) => Math.ceil(event.end / 60))),
    ),
  );
  readonly hours = computed(() =>
    Array.from({ length: this.lastHour() - this.firstHour() }, (_, i) => this.firstHour() + i),
  );
  readonly height = computed(() => this.hours().length * 96);
  readonly heading = computed(() => {
    const format = (date: string) =>
      new Intl.DateTimeFormat('es-CO', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(
        new Date(date + 'T12:00:00Z'),
      );
    return this.mode() === 'day'
      ? format(this.from())
      : format(this.from()) + ' — ' + format(this.days().at(-1)!.date);
  });
  weekday(date: string) {
    return new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(date + 'T12:00:00Z'),
    );
  }
  dayNumber(date: string) {
    return Number(date.slice(-2));
  }
  resourceName(id: string) {
    return this.resources().find((resource) => resource.id === id)?.name ?? 'Recurso reservado';
  }
  time(instant: string) {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: this.zone(),
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(instant));
  }
  eventLabel(booking: Booking) {
    return `Reserva ${booking.bookingNumber}, ${this.resourceName(booking.resourceId)}, ${formatInstant(booking.startAt, this.zone())} hasta ${formatInstant(booking.endAt, this.zone())}, ${label(booking.status)}`;
  }
  openDay(date: string) {
    this.rangeChange.emit({ from: date, to: date });
  }
  move(offset: number) {
    this.emitRange(calendarDate(this.from(), offset));
  }
  today() {
    this.emitRange(dateInZone(new Date().toISOString(), this.zone()));
  }
  changeMode(mode: 'day' | 'week') {
    this.rangeChange.emit({
      from: this.from(),
      to: calendarDate(this.from(), mode === 'day' ? 0 : 6),
    });
  }
  private emitRange(from: string) {
    this.rangeChange.emit({ from, to: calendarDate(from, this.mode() === 'day' ? 0 : 6) });
  }
}
