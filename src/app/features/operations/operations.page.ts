import { Component, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { ApiError, AuditEntry, Delivery, Page } from '../../core/models';
import { apiError } from '../../core/errors';
import { EditorComponent, Field, UUID_PATTERN } from '../../shared/editor';
import { ErrorComponent, Feedback, StatusComponent } from '../../shared/feedback';
import { DialogService } from '../../shared/dialog';
import { label } from '../../shared/labels';
import { OperationsService, AuditFilters } from './operations.service';
const auditFields: Field[] = [
  { key: 'companyId', label: 'ID de compañía', pattern: UUID_PATTERN },
  { key: 'action', label: 'Acción', hint: 'Filtro exacto; por ejemplo BOOKING_CREATED.' },
  {
    key: 'entityType',
    label: 'Tipo de entidad',
    hint: 'Filtro exacto; por ejemplo BOOKING o RESOURCE.',
  },
  { key: 'entityId', label: 'ID de entidad', pattern: UUID_PATTERN },
];
const deliveryFields: Field[] = [
  {
    key: 'status',
    label: 'Estado de entrega',
    type: 'select',
    required: true,
    options: [
      { value: 'FAILED', label: 'Fallida' },
      { value: 'PENDING', label: 'Pendiente' },
      { value: 'SENDING', label: 'Enviando' },
      { value: 'SENT', label: 'Enviada' },
    ],
  },
];
@Component({
  selector: 'app-operations-page',
  imports: [EditorComponent, ErrorComponent, StatusComponent],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Plataforma</p>
        <h1>Operaciones</h1>
        <p>Auditoría y recuperación de notificaciones en todas las compañías.</p>
      </div>
      <div class="actions">
        <button
          [attr.aria-pressed]="tab() === 'audit'"
          [disabled]="busy()"
          (click)="switchTab('audit')"
        >
          Auditoría</button
        ><button
          [attr.aria-pressed]="tab() === 'deliveries'"
          [disabled]="busy()"
          (click)="switchTab('deliveries')"
        >
          Notificaciones
        </button>
      </div>
    </header>
    <app-error [error]="error()" />
    <section class="panel">
      <h2>Filtros</h2>
      <app-editor
        [fields]="fields()"
        [values]="values()"
        [busy]="loading() || busy()"
        submitLabel="Aplicar filtros"
        (saved)="apply($event)"
        (cancelled)="reset()"
      />
    </section>
    @if (loading()) {
      <app-status [loading]="true" />
    } @else if (tab() === 'audit') {
      <section class="panel">
        <div class="table-wrap">
          <table>
            <caption>
              Registro de auditoría ·
              {{
                audit().totalElements
              }}
              eventos
            </caption>
            <thead>
              <tr>
                <th scope="col">Fecha (UTC)</th>
                <th scope="col">Acción</th>
                <th scope="col">Compañía y entidad</th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of audit().items; track entry.id) {
                <tr>
                  <td>{{ entry.createdAt }}</td>
                  <td>
                    {{ entry.action }}<small>Actor: {{ entry.actorUserId || 'Sistema' }}</small>
                  </td>
                  <td>
                    {{ entry.companyId || 'Plataforma'
                    }}<small>{{ entry.entityType }} · {{ entry.entityId }}</small>
                  </td>
                  <td><button (click)="selected.set(entry)">Ver evento</button></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">No hay eventos con estos filtros.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      @if (selected(); as entry) {
        <section class="panel" aria-labelledby="audit-detail">
          <div class="actions">
            <h2 id="audit-detail">Detalle de {{ entry.action }}</h2>
            <button (click)="selected.set(null)">Cerrar detalle</button>
          </div>
          <p>
            Evento: {{ entry.id }} · Correlación: {{ entry.correlationId || 'Sin correlación' }}
          </p>
          <h3>Antes</h3>
          <pre style="white-space:pre-wrap;overflow-wrap:anywhere">{{
            entry.beforeData || 'Sin datos previos'
          }}</pre>
          <h3>Después</h3>
          <pre style="white-space:pre-wrap;overflow-wrap:anywhere">{{
            entry.afterData || 'Sin datos posteriores'
          }}</pre>
        </section>
      }
    } @else {
      <section class="panel">
        <p>
          Un reintento pone la entrega en cola. Su envío depende del worker y del proveedor de
          correo.
        </p>
        <div class="table-wrap">
          <table>
            <caption>
              Notificaciones ·
              {{
                deliveries().totalElements
              }}
              entregas
            </caption>
            <thead>
              <tr>
                <th scope="col">Evento</th>
                <th scope="col">Estado</th>
                <th scope="col">Intentos y error</th>
                <th scope="col">Fechas (UTC)</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (delivery of deliveries().items; track delivery.id) {
                <tr>
                  <td>
                    {{ delivery.eventType }}<small>{{ delivery.id }}</small
                    ><small>Compañía: {{ delivery.companyId }}</small
                    ><small>Reserva: {{ delivery.bookingId || 'No aplica' }}</small>
                  </td>
                  <td>{{ label(delivery.status) }}</td>
                  <td>
                    {{ delivery.attempts }} intentos<small>{{
                      delivery.errorCode || 'Sin error'
                    }}</small>
                  </td>
                  <td>
                    Creada: {{ delivery.createdAt
                    }}<small>Próximo intento: {{ delivery.nextAttemptAt || 'No programado' }}</small
                    ><small>Enviada: {{ delivery.sentAt || 'Pendiente' }}</small>
                  </td>
                  <td>
                    @if (delivery.status === 'FAILED') {
                      <button [disabled]="busy()" (click)="replay(delivery)">
                        Reintentar entrega
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">No hay notificaciones con este estado.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
    <nav class="actions" aria-label="Páginas de operaciones">
      <button [disabled]="page() === 0 || busy() || loading()" (click)="paginate(-1)">
        Anterior</button
      ><span>Página {{ page() + 1 }} de {{ totalPages() || 1 }}</span
      ><button [disabled]="page() + 1 >= totalPages() || busy() || loading()" (click)="paginate(1)">
        Siguiente</button
      ><button [disabled]="busy() || loading()" (click)="load()">Actualizar</button>
    </nav>
  `,
})
export class OperationsPage {
  private readonly service = inject(OperationsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly feedback = inject(Feedback);
  readonly tab = signal<'audit' | 'deliveries'>(
    this.route.snapshot.queryParamMap.get('tab') === 'deliveries' ? 'deliveries' : 'audit',
  );
  readonly page = signal(Math.max(0, Number(this.route.snapshot.queryParamMap.get('page')) || 0));
  readonly audit = signal<Page<AuditEntry>>({
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  readonly deliveries = signal<Page<Delivery>>({
    items: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  readonly selected = signal<AuditEntry | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly fields = signal<Field[]>(this.tab() === 'audit' ? auditFields : deliveryFields);
  readonly values = signal<Record<string, string>>({
    companyId: this.route.snapshot.queryParamMap.get('companyId') ?? '',
    action: this.route.snapshot.queryParamMap.get('action') ?? '',
    entityType: this.route.snapshot.queryParamMap.get('entityType') ?? '',
    entityId: this.route.snapshot.queryParamMap.get('entityId') ?? '',
    status: this.route.snapshot.queryParamMap.get('status') ?? 'FAILED',
  });
  readonly editor = viewChild(EditorComponent);
  readonly label = label;
  constructor() {
    void this.load();
  }
  hasUnsavedChanges() {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }
  totalPages() {
    return this.tab() === 'audit' ? this.audit().totalPages : this.deliveries().totalPages;
  }
  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (this.tab() === 'audit') {
        const v = this.values();
        const filters: AuditFilters = {
          companyId: v['companyId'],
          action: v['action'],
          entityType: v['entityType'],
          entityId: v['entityId'],
        };
        this.audit.set(await firstValueFrom(this.service.audit(filters, this.page())));
      } else
        this.deliveries.set(
          await firstValueFrom(
            this.service.deliveries(this.values()['status'] ?? 'FAILED', this.page()),
          ),
        );
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async persist() {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.values(), tab: this.tab(), page: this.page() },
    });
  }
  async apply(values: Record<string, string>) {
    this.values.set(values);
    this.page.set(0);
    this.editor()?.markSaved();
    this.selected.set(null);
    await this.persist();
    await this.load();
  }
  async reset() {
    this.values.set(
      this.tab() === 'audit'
        ? { companyId: '', action: '', entityType: '', entityId: '' }
        : { status: 'FAILED' },
    );
    this.page.set(0);
    await this.persist();
    await this.load();
  }
  async switchTab(tab: 'audit' | 'deliveries') {
    if (
      this.hasUnsavedChanges() &&
      !(await this.dialog.confirm(
        'Cambiar vista',
        'Se descartarán los cambios de filtros sin aplicar.',
        'Cambiar vista',
      ))
    )
      return;
    this.tab.set(tab);
    this.fields.set(tab === 'audit' ? auditFields : deliveryFields);
    this.values.set(
      tab === 'audit'
        ? { companyId: '', action: '', entityType: '', entityId: '' }
        : { status: 'FAILED' },
    );
    this.page.set(0);
    this.selected.set(null);
    await this.persist();
    await this.load();
  }
  async paginate(delta: number) {
    this.page.update((page) => page + delta);
    await this.persist();
    await this.load();
  }
  async replay(delivery: Delivery) {
    if (
      this.busy() ||
      !(await this.dialog.confirm(
        'Reintentar notificación',
        'Se reiniciarán los intentos y la entrega volverá a la cola. El proveedor puede haber recibido intentos anteriores.',
        'Reintentar',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.service.replay(delivery.id));
      this.feedback.success('Entrega puesta en cola para un nuevo intento.');
      await this.load();
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
