import { Component, Injectable, input, signal } from '@angular/core';
import type { ApiError } from '../core/models';
@Injectable({ providedIn: 'root' })
export class Feedback {
  readonly message = signal('');
  success(message = 'Cambios guardados.'): void {
    this.message.set(message);
  }
  clear(): void {
    this.message.set('');
  }
}
@Component({
  selector: 'app-error',
  template: `@if (error(); as issue) {
    <section role="alert" class="error">
      <strong>{{ issue.error }}</strong
      ><span class="error-code">Código: {{ issue.code }}</span>
      @for (field of fields(); track field[0]) {
        <p>{{ field[0] }}: {{ field[1] }}</p>
      }
    </section>
  }`,
})
export class ErrorComponent {
  readonly error = input<ApiError | null>(null);
  fields(): [string, string][] {
    return Object.entries(this.error()?.fields ?? {});
  }
}
@Component({
  selector: 'app-status',
  template: `<div class="state" role="status">
    @if (loading()) {
      Cargando datos…
    } @else {
      {{ message() }}
    }
  </div>`,
})
export class StatusComponent {
  readonly loading = input(false);
  readonly message = input('');
}
