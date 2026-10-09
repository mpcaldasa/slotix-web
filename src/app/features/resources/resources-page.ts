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
import { ResourcesApi } from './resources-api';
import { Session } from '../../core/session';
import type { ApiError, Resource } from '../../core/models';
import { apiError } from '../../core/errors';
import { EditorComponent } from '../../shared/editor';
import { ErrorComponent, Feedback, StatusComponent } from '../../shared/feedback';
import { DialogService } from '../../shared/dialog';
import { label } from '../../shared/labels';
import { resourceBody, resourceFields } from './resource-fields';
@Component({
  selector: 'app-resources-page',
  imports: [RouterLink, EditorComponent, ErrorComponent, StatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">Compañía / Recursos</p>
        <h1>Recursos</h1>
        <p>Gestiona los espacios, equipos, personas y servicios de tu compañía.</p>
      </div>
      @if (session.admin()) {
        <button class="primary" (click)="open()" [disabled]="busy()">Crear recurso</button>
      }
    </header>
    <app-error [error]="error()" />
    @if (creating()) {
      <section class="panel">
        <h2>Nuevo recurso</h2>
        <app-editor
          [fields]="fields"
          [values]="defaults"
          [busy]="busy()"
          (saved)="save($event)"
          (cancelled)="cancel()"
        />
      </section>
    }
    <section class="panel">
      <div class="toolbar">
        <label for="resource-search"
          >Buscar por nombre<input
            id="resource-search"
            type="search"
            [value]="search()"
            (input)="filter($event)" /></label
        ><button (click)="load()" [disabled]="loading() || busy()">Actualizar</button>
      </div>
      @if (loading()) {
        <app-status [loading]="true" />
      } @else if (!filtered().length) {
        <app-status
          [message]="
            search()
              ? 'No hay recursos que coincidan con tu búsqueda.'
              : 'No hay recursos disponibles para tu identidad.'
          "
        />
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="sr-only">
              Recursos de la compañía
            </caption>
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Tipo</th>
                <th>Capacidad</th>
                <th>Visibilidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (resource of visible(); track resource.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/resources', resource.id]">{{ resource.name }}</a>
                  </td>
                  <td>{{ label(resource.resourceType) }}</td>
                  <td>{{ resource.capacity }}</td>
                  <td>{{ label(resource.visibility) }}</td>
                  <td>{{ label(resource.status) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <nav class="actions" aria-label="Paginación de recursos">
          <button (click)="setPage(page() - 1)" [disabled]="page() === 0">Anterior</button
          ><span>Página {{ page() + 1 }} de {{ pages() }} · {{ filtered().length }} recursos</span
          ><button (click)="setPage(page() + 1)" [disabled]="page() + 1 >= pages()">
            Siguiente
          </button>
        </nav>
      }
    </section>`,
})
export class ResourcesPage {
  readonly session = inject(Session);
  private readonly api = inject(ResourcesApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(Feedback);
  readonly items = signal<Resource[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly creating = signal(false);
  readonly search = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  readonly page = signal(Math.max(0, Number(this.route.snapshot.queryParamMap.get('page')) || 0));
  readonly fields = resourceFields;
  readonly defaults = { resourceType: 'SPACE', visibility: 'MEMBERS', capacity: '1' };
  readonly label = label;
  readonly editor = viewChild(EditorComponent);
  readonly filtered = computed(() =>
    this.items().filter((item) =>
      item.name.toLocaleLowerCase('es').includes(this.search().toLocaleLowerCase('es')),
    ),
  );
  readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / 20)));
  readonly visible = computed(() => this.filtered().slice(this.page() * 20, this.page() * 20 + 20));
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await firstValueFrom(this.api.list()));
      if (this.page() >= this.pages()) this.setPage(this.pages() - 1);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  open() {
    this.creating.set(true);
    this.error.set(null);
  }
  async cancel() {
    if (
      this.editor()?.hasUnsavedChanges() &&
      !(await this.dialogs.confirm(
        'Descartar cambios',
        'Los datos del recurso no se guardarán.',
        'Descartar',
      ))
    )
      return;
    this.editor()?.markSaved();
    this.creating.set(false);
  }
  async save(values: Record<string, string>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const resource = await firstValueFrom(this.api.create(resourceBody(values)));
      this.editor()?.markSaved();
      this.feedback.success(
        'Recurso creado como borrador. Configura horarios y política antes de activarlo.',
      );
      this.creating.set(false);
      await this.router.navigate(['/resources', resource.id]);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  filter(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
    this.setPage(0);
  }
  setPage(page: number) {
    this.page.set(Math.max(0, page));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.search() || null, page: this.page() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  hasUnsavedChanges() {
    return this.editor()?.hasUnsavedChanges() ?? false;
  }
}
