import { Component, inject, signal, viewChild, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api } from '../../core/api';
import { apiError } from '../../core/errors';
import { formatInstant } from '../../core/time';
import { CONFIG } from '../../core/config';
import type { ApiError, Booking, Page } from '../../core/models';
import type { Customer } from './customer-picker';
import { ErrorComponent, Feedback } from '../../shared/feedback';
import { EditorComponent, Field } from '../../shared/editor';
import { PaginationComponent } from '../../shared/pagination';
import { DialogService } from '../../shared/dialog';
import { RouterLink } from '@angular/router';
import { label } from '../../shared/labels';
@Component({
  selector: 'app-customers-page',
  imports: [RouterLink, ErrorComponent, EditorComponent, PaginationComponent],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Compañía / Clientes</p>
        <h1 tabindex="-1">Clientes y contactos</h1>
        <p>Personas de tu compañía, sus datos de contacto y sus reservas.</p>
      </div>
    </header>
    <app-error [error]="error()" />
    <section class="panel">
      <div class="toolbar">
        <label for="directory-query"
          >Nombre, correo o teléfono<input
            id="directory-query"
            type="search"
            maxlength="120"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            (keydown.enter)="load(0)" /></label
        ><button [disabled]="busy()" (click)="load(0)">Buscar</button>
      </div>
      @if (busy()) {
        <p role="status">Cargando clientes…</p>
      } @else {
        <div class="table-wrap">
          <table>
            <caption>
              Directorio de la compañía
            </caption>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (person of people(); track person.userId) {
                <tr>
                  <td>{{ person.fullName }}</td>
                  <td>
                    {{ person.email }}<small>{{ person.phone || 'Sin teléfono registrado' }}</small>
                  </td>
                  <td>{{ person.active ? 'Activo' : 'Inactivo' }}</td>
                  <td><button (click)="open(person)">Ver ficha</button></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">No encontramos personas con esa búsqueda.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination
          [total]="total()"
          [size]="20"
          [page]="page()"
          [busy]="busy()"
          (pageChange)="load($event)"
        />
      }
    </section>
    @if (selected(); as person) {
      <section class="panel" aria-labelledby="customer-profile-heading">
        <h2 id="customer-profile-heading">{{ person.fullName }}</h2>
        <p>{{ person.email }}</p>
        <p>
          El teléfono y las notas solo se guardan para esta compañía. El nombre y el correo
          pertenecen a la cuenta de la persona.
        </p>
        <app-editor
          id="customer-profile"
          [fields]="fields"
          [values]="profileValues()"
          [busy]="saving()"
          submitLabel="Guardar contacto"
          (saved)="save($event)"
          (cancelled)="close()"
        />
        <h3>Historial de reservas</h3>
        @if (historyBusy()) {
          <p role="status">Cargando historial…</p>
        } @else {
          <div class="table-wrap">
            <table>
              <caption>
                Reservas de
                {{
                  person.fullName
                }}
              </caption>
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (booking of history(); track booking.id) {
                  <tr>
                    <td>
                      <a [routerLink]="['/bookings', booking.id]"
                        >Reserva #{{ booking.bookingNumber }}</a
                      >
                    </td>
                    <td>{{ format(booking.startAt) }}</td>
                    <td>{{ label(booking.status) }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3">Esta persona aún no tiene reservas.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pagination
            [total]="historyTotal()"
            [size]="20"
            [page]="historyPage()"
            (pageChange)="loadHistory($event)"
          />
        }
      </section>
    }
  `,
})
export class CustomersPage {
  private readonly api = inject(Api);
  readonly editor = viewChild(EditorComponent);
  private readonly dialogs = inject(DialogService);
  private historyVersion = 0;
  hasUnsavedChanges() {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }
  private async canDiscard() {
    return (
      !this.hasUnsavedChanges() ||
      (await this.dialogs.confirm(
        'Descartar cambios',
        'Los datos de contacto que no guardaste se perderán.',
        'Descartar',
      ))
    );
  }
  private readonly feedback = inject(Feedback);
  private readonly config = inject(CONFIG);
  readonly query = signal('');
  readonly people = signal<Customer[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly busy = signal(false);
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly selected = signal<Customer | null>(null);
  readonly profileValues = computed(() => ({
    phone: this.selected()?.phone ?? '',
    notes: this.selected()?.notes ?? '',
  }));
  readonly history = signal<Booking[]>([]);
  readonly historyTotal = signal(0);
  readonly historyPage = signal(0);
  readonly historyBusy = signal(false);
  readonly fields: Field[] = [
    { key: 'phone', label: 'Teléfono', maxLength: 40, pattern: '[0-9+() .-]*' },
    {
      key: 'notes',
      label: 'Notas de atención',
      type: 'textarea',
      maxLength: 2000,
      hint: 'Evita registrar información sensible que no sea necesaria para las reservas.',
    },
  ];
  readonly label = label;
  readonly format = (value: string) => formatInstant(value, this.config.companyTimezone);
  constructor() {
    void this.load(0);
  }
  async load(page: number) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.api.get<Page<Customer>>(this.api.companyPath('/customers'), {
          query: this.query().trim(),
          page,
          size: 20,
        }),
      );
      this.people.set(result.items);
      this.total.set(result.totalElements);
      this.page.set(page);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async open(person: Customer) {
    if (!(await this.canDiscard())) return;
    this.selected.set(person);
    this.history.set([]);
    this.historyTotal.set(0);
    void this.loadHistory(0);
  }
  async close() {
    if (await this.canDiscard()) {
      this.historyVersion++;
      this.selected.set(null);
    }
  }
  async loadHistory(page: number) {
    const person = this.selected();
    if (!person) return;
    const version = ++this.historyVersion;
    this.historyBusy.set(true);
    try {
      const result = await firstValueFrom(
        this.api.get<Page<Booking>>(
          this.api.companyPath('/customers/' + person.userId + '/bookings'),
          { page, size: 20 },
        ),
      );
      if (version !== this.historyVersion || this.selected()?.userId !== person.userId) return;
      this.history.set(result.items);
      this.historyTotal.set(result.totalElements);
      this.historyPage.set(page);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      if (version === this.historyVersion) this.historyBusy.set(false);
    }
  }
  async save(values: Record<string, string>) {
    const person = this.selected();
    if (!person || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const updated = await firstValueFrom(
        this.api.put<Customer>(this.api.companyPath('/customers/' + person.userId), {
          phone: values['phone'] || '',
          notes: values['notes'] || '',
        }),
      );
      this.selected.set(updated);
      this.people.update((items) =>
        items.map((item) => (item.userId === updated.userId ? updated : item)),
      );
      this.editor()?.markSaved();
      this.feedback.success('Datos de contacto guardados.');
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
