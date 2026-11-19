import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Api } from '../../core/api';
import { CustomerPicker } from './customer-picker';
describe('customer picker', () => {
  const person = {
    userId: 'customer',
    fullName: 'Ana Ruiz',
    email: 'ana@example.test',
    phone: '',
    notes: '',
    active: true,
  };
  it('searches active tenant contacts and emits a selected identity without free-form identifiers', async () => {
    const api = {
      companyPath: () => '/v1/companies/company/customers',
      get: vi.fn(() => of({ items: [person], totalElements: 1 })),
    };
    TestBed.configureTestingModule({ providers: [{ provide: Api, useValue: api }] });
    const fixture = TestBed.createComponent(CustomerPicker);
    const picker = fixture.componentInstance;
    const selected = vi.fn();
    picker.chosen.subscribe(selected);
    picker.query.set(' Ana ');
    await picker.search();
    fixture.detectChanges();
    expect(api.get).toHaveBeenCalledWith('/v1/companies/company/customers', {
      query: 'Ana',
      activeOnly: true,
      size: 20,
    });
    fixture.nativeElement.querySelector('li button').click();
    expect(selected).toHaveBeenCalledWith(person);
    expect(picker.people()).toEqual([]);
    picker.select(null);
    expect(selected).toHaveBeenLastCalledWith(null);
  });
  it('keeps the selected contact when a search fails and releases the loading state', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Api,
          useValue: {
            companyPath: () => '/customers',
            get: () => throwError(() => new Error('offline')),
          },
        },
      ],
    });
    const picker = TestBed.createComponent(CustomerPicker).componentInstance;
    picker.select(person);
    await picker.search();
    expect(picker.selected()).toEqual(person);
    expect(picker.error()).not.toBeNull();
    expect(picker.loading()).toBe(false);
  });
});
