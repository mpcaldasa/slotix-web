import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ApiError, Booking } from '../../core/models';
import { ErrorComponent } from '../../shared/feedback';
import { formatInstant } from '../../core/time';
import { label } from '../../shared/labels';
@Component({
  selector: 'app-booking-preview',
  imports: [RouterLink, ErrorComponent],
  template: ` <dialog
    #dialog
    aria-labelledby="booking-preview-title"
    (cancel)="$event.preventDefault(); closed.emit()"
  >
    <h2 id="booking-preview-title">
      {{ booking() ? 'Reserva #' + booking()?.bookingNumber : 'Detalle de reserva' }}
    </h2>
    <app-error [error]="error()" />
    @if (busy()) {
      <p role="status">Cargando reserva…</p>
    } @else if (booking(); as item) {
      <dl class="detail-grid">
        <div>
          <dt>Cliente</dt>
          <dd>{{ item.customerName || 'Cliente de la compañía' }}</dd>
        </div>
        <div>
          <dt>Recurso</dt>
          <dd>{{ item.resourceName || 'Recurso reservado' }}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <span class="status-pill" [attr.data-status]="item.status">{{
              label(item.status)
            }}</span>
          </dd>
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
          <dt>Notas</dt>
          <dd>{{ item.notes || 'Sin notas' }}</dd>
        </div>
      </dl>
    }
    <div class="actions">
      <button type="button" autofocus (click)="closed.emit()">Cerrar detalle</button>
      @if (booking(); as item) {
        <a class="button primary" [routerLink]="['/bookings', item.id]" (click)="closed.emit()"
          >Abrir reserva</a
        >
      }
    </div>
  </dialog>`,
})
export class BookingPreview {
  readonly open = input(false);
  readonly booking = input<Booking | null>(null);
  readonly busy = input(false);
  readonly error = input<ApiError | null>(null);
  readonly closed = output<void>();
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly label = label;
  readonly format = formatInstant;
  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      else if (!this.open() && dialog.open) dialog.close();
    });
  }
}
