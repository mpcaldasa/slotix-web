import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Api } from '../../core/api';
import { CONFIG } from '../../core/config';
import { RemindersPage } from './reminders.page';
describe('reminder settings', () => {
  it('discarding restores the saved notice and shows named delivery history', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CONFIG, useValue: { companyTimezone: 'America/Bogota' } },
        {
          provide: Api,
          useValue: {
            companyPath: (path: string) => path,
            get: (path: string) =>
              of(
                path.endsWith('/history')
                  ? {
                      items: [
                        {
                          id: 'delivery',
                          bookingId: 'booking',
                          bookingNumber: 42,
                          customerName: 'Ana Torres',
                          startAt: '2026-11-21T14:00:00Z',
                          status: 'SENT',
                          sentAt: '2026-11-20T14:00:00Z',
                        },
                      ],
                      totalElements: 1,
                      page: 0,
                      size: 20,
                      totalPages: 1,
                    }
                  : { enabled: false, minutesBefore: 60 },
              ),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(RemindersPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.editor()!.form.controls['minutesBefore']!.setValue('30');
    page.reset();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(page.editor()!.form.controls['minutesBefore']!.value).toBe('60');
    expect(fixture.nativeElement.textContent).toContain('Ana Torres');
  });
});
