import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  template: `
    <nav class="pagination" [attr.aria-label]="label()">
      <p>{{ total() ? current() * size() + 1 : 0 }}–{{ end() }} de {{ total() }} resultados</p>
      <div class="actions">
        <button [disabled]="busy() || current() === 0" (click)="pageChange.emit(current() - 1)">
          Anterior
        </button>
        <span aria-live="polite">Página {{ current() + 1 }} de {{ pages() }}</span>
        <button
          [disabled]="busy() || current() + 1 >= pages()"
          (click)="pageChange.emit(current() + 1)"
        >
          Siguiente
        </button>
      </div>
    </nav>
  `,
})
export class PaginationComponent {
  readonly total = input.required<number>();
  readonly page = input(0);
  readonly size = input(10);
  readonly busy = input(false);
  readonly label = input('Paginación');
  readonly pageChange = output<number>();
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  readonly current = computed(() => Math.max(0, Math.min(this.page(), this.pages() - 1)));
  readonly end = computed(() => Math.min(this.total(), (this.current() + 1) * this.size()));
}
