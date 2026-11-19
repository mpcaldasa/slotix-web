import { Component, inject, output, signal, input } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import type { ApiError, Page } from '../../core/models';
import { ErrorComponent } from '../../shared/feedback';
export type Customer = {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
};
@Component({
  selector: 'app-customer-picker',
  imports: [ErrorComponent],
  template: `
    <section aria-labelledby="customer-heading">
      <h2 id="customer-heading">¿Para quién es la reserva?</h2>
      <p>Busca a una persona de tu compañía. Si no eliges a nadie, la reserva será para ti.</p>
      <div class="toolbar">
        <label for="customer-search"
          >Nombre, correo o teléfono
          <input
            id="customer-search"
            type="search"
            maxlength="120"
            [disabled]="disabled()"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown.enter)="$event.preventDefault(); search()"
          />
        </label>
        <button type="button" [disabled]="loading() || disabled()" (click)="search()">
          Buscar persona
        </button>
      </div>
      <app-error [error]="error()" />
      @if (loading()) {
        <p role="status">Buscando personas…</p>
      }
      @if (selected(); as person) {
        <p role="status">
          <strong>Reserva para {{ person.fullName }}</strong> · {{ person.email }}
        </p>
        <button type="button" [disabled]="disabled()" (click)="select(null)">
          Reservar para mí
        </button>
      }
      @if (searched() && !loading()) {
        @if (!people().length) {
          <p role="status">No encontramos personas. Prueba con otro nombre o correo.</p>
        } @else {
          <ul class="slot-list" aria-label="Personas encontradas">
            @for (person of people(); track person.userId) {
              <li>
                <button type="button" [disabled]="disabled()" (click)="select(person)">
                  <strong>{{ person.fullName }}</strong
                  ><span>{{ person.email }}</span
                  ><span class="visually-hidden">Elegir persona</span>
                </button>
              </li>
            }
          </ul>
          @if (total() > people().length) {
            <p>
              Mostramos las primeras 20 coincidencias. Escribe un nombre o correo más específico.
            </p>
          }
        }
      }
    </section>
  `,
})
export class CustomerPicker {
  private readonly api = inject(Api);
  readonly disabled = input(false);
  readonly chosen = output<Customer | null>();
  readonly query = signal('');
  readonly selected = signal<Customer | null>(null);
  readonly people = signal<Customer[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly searched = signal(false);
  readonly error = signal<ApiError | null>(null);
  async search() {
    if (this.loading() || this.disabled()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.api.get<Page<Customer>>(this.api.companyPath('/customers'), {
          query: this.query().trim(),
          activeOnly: true,
          size: 20,
        }),
      );
      this.people.set(result.items);
      this.total.set(result.totalElements);
      this.searched.set(true);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  select(person: Customer | null) {
    this.selected.set(person);
    this.people.set([]);
    this.searched.set(false);
    this.chosen.emit(person);
  }
}
