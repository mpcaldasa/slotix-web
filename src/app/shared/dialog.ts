import {
  Component,
  ElementRef,
  Injectable,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
interface Confirmation {
  title: string;
  description: string;
  action: string;
  resolve: (value: boolean) => void;
}
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly current = signal<Confirmation | null>(null);
  confirm(title: string, description: string, action: string): Promise<boolean> {
    if (this.current()) return Promise.resolve(false);
    return new Promise((resolve) => this.current.set({ title, description, action, resolve }));
  }
  finish(value: boolean): void {
    this.current()?.resolve(value);
    this.current.set(null);
  }
}
@Component({
  selector: 'app-dialog',
  template: ` <dialog
    #dialog
    aria-labelledby="confirmation-title"
    aria-describedby="confirmation-description"
    (cancel)="cancel($event)"
  >
    @if (service.current(); as current) {
      <h2 id="confirmation-title">{{ current.title }}</h2>
      <p id="confirmation-description">{{ current.description }}</p>
      <div class="actions">
        <button type="button" autofocus (click)="service.finish(false)">Volver</button
        ><button type="button" class="danger" (click)="service.finish(true)">
          {{ current.action }}
        </button>
      </div>
    }
  </dialog>`,
})
export class DialogComponent {
  readonly service = inject(DialogService);
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.service.current()) {
        if (!element.open) element.showModal();
      } else if (element.open) element.close();
    });
  }
  cancel(event: Event): void {
    event.preventDefault();
    this.service.finish(false);
  }
}
