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
import { Session } from '../../core/session';
import type { ApiError, Resource } from '../../core/models';
import { apiError } from '../../core/errors';
import { DialogService } from '../../shared/dialog';
import { EditorComponent } from '../../shared/editor';
import { ErrorComponent, Feedback, StatusComponent } from '../../shared/feedback';
import { label } from '../../shared/labels';
import { ResourcesApi } from './resources-api';
import { resourceBody, resourceFields } from './resource-fields';
import { ResourceSchedule } from '../availability/resource-schedule';
import { ResourceAssignments } from '../policies/resource-assignments';
@Component({
  selector: 'app-resource-detail',
  imports: [
    RouterLink,
    EditorComponent,
    ErrorComponent,
    StatusComponent,
    ResourceSchedule,
    ResourceAssignments,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">Compañía / Recursos / Detalle</p>
        <h1>{{ resource()?.name ?? 'Recurso' }}</h1>
        <p>{{ resource()?.id }}</p>
      </div>
      <a routerLink="/resources">Volver a recursos</a>
    </header>
    <app-error [error]="error()" />
    @if (loading()) {
      <app-status [loading]="true" />
    } @else if (resource(); as item) {
      <section class="panel">
        <div class="detail-grid">
          <div>
            <strong>Estado</strong><span>{{ label(item.status) }}</span>
          </div>
          <div>
            <strong>Tipo</strong><span>{{ label(item.resourceType) }}</span>
          </div>
          <div>
            <strong>Capacidad simultánea</strong><span>{{ item.capacity }}</span>
          </div>
          <div>
            <strong>Visibilidad</strong><span>{{ label(item.visibility) }}</span>
          </div>
        </div>
        <p>{{ item.description }}</p>
        @if (session.admin()) {
          <div class="actions">
            <button [disabled]="busy()" (click)="toggleEdit()">
              {{ edit() ? 'Cerrar edición' : 'Editar recurso' }}</button
            ><button
              [disabled]="busy()"
              (click)="state(item.status === 'ACTIVE' ? 'deactivate' : 'activate')"
            >
              {{ item.status === 'ACTIVE' ? 'Desactivar' : 'Activar' }}</button
            ><button class="danger" [disabled]="busy()" (click)="remove()">Eliminar recurso</button>
          </div>
        }
        @if (edit()) {
          <h2>Editar recurso</h2>
          <app-editor
            [fields]="fields"
            [values]="values()"
            [busy]="busy()"
            (saved)="save($event)"
            (cancelled)="toggleEdit()"
          />
        }
      </section>
      <app-resource-schedule [resourceId]="item.id" /><app-resource-assignments
        [resourceId]="item.id"
      />
    }
    <button [disabled]="loading() || busy()" (click)="load()">Actualizar recurso</button>`,
})
export class ResourceDetailPage {
  private readonly api = inject(ResourcesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(Feedback);
  readonly session = inject(Session);
  readonly resource = signal<Resource | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly edit = signal(false);
  readonly fields = resourceFields;
  readonly label = label;
  readonly editor = viewChild(EditorComponent);
  readonly schedule = viewChild(ResourceSchedule);
  readonly assignments = viewChild(ResourceAssignments);
  readonly values = signal<Record<string, string>>({});
  constructor() {
    void this.load();
  }
  async load() {
    if (
      this.hasUnsavedChanges() &&
      !(await this.dialogs.confirm(
        'Descartar cambios',
        'Actualizar el recurso descartará los cambios pendientes en sus formularios.',
        'Descartar y actualizar',
      ))
    )
      return;
    this.markSaved();
    this.loading.set(true);
    this.error.set(null);
    try {
      const items = await firstValueFrom(this.api.list());
      const resource = items.find((item) => item.id === this.route.snapshot.paramMap.get('id'));
      this.resource.set(resource ?? null);
      if (!resource)
        this.error.set({
          status: 404,
          code: 'RESOURCE_NOT_FOUND',
          error: 'El recurso no está disponible para esta identidad.',
          fields: {},
        });
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  async toggleEdit() {
    if (
      this.edit() &&
      this.editor()?.hasUnsavedChanges() &&
      !(await this.dialogs.confirm(
        'Descartar cambios',
        'Los cambios del recurso no se guardarán.',
        'Descartar',
      ))
    )
      return;
    this.editor()?.markSaved();
    if (!this.edit())
      this.values.set(
        Object.fromEntries(
          Object.entries(this.resource() ?? {}).map(([key, value]) => [key, String(value ?? '')]),
        ),
      );
    this.edit.update((value) => !value);
  }
  async save(v: Record<string, string>) {
    if (this.busy() || !this.session.admin()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const resource = await firstValueFrom(this.api.update(this.resource()!.id, resourceBody(v)));
      this.editor()?.markSaved();
      this.resource.set(resource);
      this.edit.set(false);
      this.feedback.success();
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async state(action: 'activate' | 'deactivate') {
    const resource = this.resource();
    if (
      this.busy() ||
      !resource ||
      !this.session.admin() ||
      !(await this.dialogs.confirm(
        action === 'activate' ? 'Activar recurso' : 'Desactivar recurso',
        action === 'activate'
          ? 'La disponibilidad requiere horarios y una política activa asignada.'
          : 'El recurso dejará de ofrecer disponibilidad; las reservas existentes se conservan.',
        action === 'activate' ? 'Activar' : 'Desactivar',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.resource.set(await firstValueFrom(this.api.state(resource.id, action)));
      this.feedback.success();
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async remove() {
    const resource = this.resource();
    if (
      this.busy() ||
      !resource ||
      !this.session.admin() ||
      !(await this.dialogs.confirm(
        'Eliminar recurso',
        resource.name +
          ' se retirará del catálogo permanentemente y los cambios pendientes se descartarán. Las reservas activas futuras impiden eliminarlo. Su historial se conserva.',
        'Eliminar recurso',
      ))
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.remove(resource.id));
      this.markSaved();
      this.feedback.success('Recurso eliminado.');
      await this.router.navigateByUrl('/resources');
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  private markSaved() {
    this.editor()?.markSaved();
    this.schedule()?.editor()?.markSaved();
    this.assignments()?.editor()?.markSaved();
  }
  hasUnsavedChanges() {
    return !!(
      this.editor()?.hasUnsavedChanges() ||
      this.schedule()?.hasUnsavedChanges() ||
      this.assignments()?.hasUnsavedChanges()
    );
  }
}
