import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { EditorComponent, passwordBytes } from './editor';
describe('accessible typed editor', () => {
  it('validates UTF-8 bytes rather than character count for passwords', () => {
    expect(passwordBytes(new FormControl('é'.repeat(36)))).toBeNull();
    expect(passwordBytes(new FormControl('é'.repeat(37)))).toEqual({ passwordBytes: true });
  });
  it('associates validation errors and blocks invalid or busy submissions', async () => {
    const fixture = TestBed.createComponent(EditorComponent);
    fixture.componentRef.setInput('fields', [
      { key: 'email', label: 'Correo', type: 'email', required: true },
    ]);
    await fixture.whenStable();
    const values: Record<string, string>[] = [];
    fixture.componentInstance.saved.subscribe((value) => values.push(value));
    fixture.componentInstance.submit();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('edit-email-help');
    expect(values).toEqual([]);
    fixture.componentInstance.form.controls['email']!.setValue('user@example.test');
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    fixture.componentInstance.submit();
    expect(values).toEqual([]);
    fixture.componentRef.setInput('busy', false);
    fixture.detectChanges();
    fixture.componentInstance.submit();
    expect(values).toEqual([{ email: 'user@example.test' }]);
  });
  it('toggles password visibility without changing its value', async () => {
    const fixture = TestBed.createComponent(EditorComponent);
    fixture.componentRef.setInput('fields', [
      { key: 'password', label: 'Contraseña', type: 'password' },
    ]);
    fixture.componentRef.setInput('values', { password: 'unchanged' });
    await fixture.whenStable();
    fixture.componentInstance.toggle('password');
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).type).toBe('text');
    expect(fixture.componentInstance.form.getRawValue()['password']).toBe('unchanged');
    fixture.componentInstance.form.markAsDirty();
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    fixture.componentInstance.markSaved();
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });
});
