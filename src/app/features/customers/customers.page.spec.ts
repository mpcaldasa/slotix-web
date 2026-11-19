import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Api } from '../../core/api';
import { CONFIG } from '../../core/config';
import { DialogService } from '../../shared/dialog';
import { CustomersPage } from './customers.page';
describe('customer profile changes', () => {
  it('discards another person draft even when both saved profiles have identical contact fields', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CONFIG, useValue: { companyTimezone: 'America/Bogota' } },
        { provide: DialogService, useValue: { confirm: async () => true } },
        {
          provide: Api,
          useValue: {
            companyPath: (path: string) => path,
            get: () => of({ items: [], totalElements: 0, page: 0, size: 20, totalPages: 0 }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CustomersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const page = fixture.componentInstance;
    const person = {
      userId: 'ana',
      fullName: 'Ana',
      email: 'ana@example.test',
      phone: '',
      notes: '',
      active: true,
    };
    await page.open(person);
    fixture.detectChanges();
    await fixture.whenStable();
    page.editor()!.form.controls['notes']!.setValue('Private draft');
    await page.open({ ...person, userId: 'luis', fullName: 'Luis' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.editor()!.form.controls['notes']!.value).toBe('');
    expect(page.selected()?.fullName).toBe('Luis');
  });
});
