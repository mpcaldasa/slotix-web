import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormRecord,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
export interface Field {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'time' | 'textarea' | 'select';
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: string;
  hint?: string;
  autocomplete?: string;
  options?: readonly { value: string; label: string }[];
  validators?: ValidatorFn[];
}
export const passwordBytes: ValidatorFn = (control) =>
  new TextEncoder().encode(String(control.value)).length > 72 ? { passwordBytes: true } : null;
export const UUID_PATTERN =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
@Component({
  selector: 'app-editor',
  imports: [ReactiveFormsModule],
  template: ` <form
    novalidate
    [formGroup]="form"
    (ngSubmit)="submit()"
    class="editor"
    [attr.aria-busy]="busy()"
  >
    @for (field of fields(); track field.key) {
      <div class="field">
        <label [for]="id() + '-' + field.key"
          >{{ field.label }}
          @if (field.required) {
            <span aria-hidden="true">*</span>
          }
        </label>
        @if (field.type === 'select') {
          <select
            [id]="id() + '-' + field.key"
            [formControlName]="field.key"
            [attr.aria-invalid]="invalid(field.key)"
            [attr.aria-describedby]="id() + '-' + field.key + '-help'"
          >
            <option value="">Selecciona una opción</option>
            @for (option of field.options; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        } @else if (field.type === 'textarea') {
          <textarea
            style="resize: none"
            rows="4"
            [id]="id() + '-' + field.key"
            [formControlName]="field.key"
            [attr.maxlength]="field.maxLength ?? null"
            [attr.aria-invalid]="invalid(field.key)"
            [attr.aria-describedby]="id() + '-' + field.key + '-help'"
          ></textarea>
        } @else {
          <div class="input-row">
            <input
              [id]="id() + '-' + field.key"
              [formControlName]="field.key"
              [type]="
                field.type === 'password' && revealed().has(field.key)
                  ? 'text'
                  : (field.type ?? 'text')
              "
              [attr.autocomplete]="field.autocomplete ?? 'off'"
              [attr.min]="field.min ?? null"
              [attr.max]="field.max ?? null"
              [attr.maxlength]="field.maxLength ?? null"
              [attr.aria-invalid]="invalid(field.key)"
              [attr.aria-describedby]="id() + '-' + field.key + '-help'"
            />
            @if (field.type === 'password') {
              <button
                type="button"
                (click)="toggle(field.key)"
                [attr.aria-pressed]="revealed().has(field.key)"
              >
                {{ revealed().has(field.key) ? 'Ocultar' : 'Mostrar' }} contraseña
              </button>
            }
          </div>
        }
        <small [id]="id() + '-' + field.key + '-help'" [class.field-error]="invalid(field.key)">{{
          invalid(field.key) ? errorText(field.key) : (field.hint ?? ' ')
        }}</small>
      </div>
    }
    <div class="actions">
      <button class="primary" type="submit" [disabled]="busy()">{{ submitLabel() }}</button
      ><button type="button" [disabled]="busy()" (click)="cancelled.emit()">Cancelar</button>
    </div>
  </form>`,
})
export class EditorComponent {
  readonly fields = input.required<readonly Field[]>();
  readonly values = input<Record<string, string>>({});
  readonly id = input('edit');
  readonly busy = input(false);
  readonly submitLabel = input('Guardar');
  readonly saved = output<Record<string, string>>();
  readonly cancelled = output<void>();
  readonly revealed = signal(new Set<string>());
  readonly form = new FormRecord<FormControl<string>>({});
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  constructor() {
    effect(() => {
      const fields = this.fields();
      const values = this.values();
      for (const key of Object.keys(this.form.controls)) this.form.removeControl(key);
      for (const field of fields) {
        const validators: ValidatorFn[] = [...(field.validators ?? [])];
        if (field.required) validators.push(Validators.required);
        if (field.type === 'email') validators.push(Validators.email);
        if (field.min !== undefined) validators.push(Validators.min(field.min));
        if (field.max !== undefined) validators.push(Validators.max(field.max));
        if (field.maxLength !== undefined) validators.push(Validators.maxLength(field.maxLength));
        if (field.pattern) validators.push(Validators.pattern(field.pattern));
        this.form.addControl(
          field.key,
          new FormControl(values[field.key] ?? '', { nonNullable: true, validators }),
        );
      }
      this.form.markAsPristine();
    });
  }
  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }
  markSaved(): void {
    this.form.markAsPristine();
  }
  invalid(key: string): boolean {
    const control = this.form.controls[key];
    return !!control && control.invalid && control.touched;
  }
  errorText(key: string): string {
    const error = this.form.controls[key]?.errors;
    return error?.['passwordBytes']
      ? 'La contraseña no puede superar 72 bytes UTF-8.'
      : error?.['required']
        ? 'Completa este campo.'
        : error?.['email']
          ? 'Ingresa un correo válido.'
          : error?.['min'] || error?.['max']
            ? 'Revisa el rango permitido.'
            : 'Revisa el formato y la longitud indicados.';
  }
  submit(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      afterNextRender(
        () => {
          const first = this.element.nativeElement.querySelector(
            '[aria-invalid="true"]',
          ) as HTMLElement | null;
          first?.focus();
        },
        { injector: this.injector },
      );
      return;
    }
    this.saved.emit(this.form.getRawValue());
  }
  toggle(key: string): void {
    const next = new Set(this.revealed());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.revealed.set(next);
  }
  @HostListener('window:beforeunload', ['$event']) unload(event: BeforeUnloadEvent): void {
    if (this.form.dirty) event.preventDefault();
  }
}
