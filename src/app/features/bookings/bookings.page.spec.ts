import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CONFIG } from '../../core/config';
import { Session } from '../../core/session';
import type { Booking, BookingInput, Resource, Slot } from '../../core/models';
import { DialogService } from '../../shared/dialog';
import { BookingsApi } from './bookings-api';
import { BookingCreatePage, BookingsPage } from './bookings.page';

const resource: Resource = {
  id: 'resource',
  companyId: 'company',
  name: 'Room',
  description: '',
  resourceType: 'SPACE',
  capacity: 4,
  status: 'ACTIVE',
  visibility: 'MEMBERS',
  createdAt: '',
  updatedAt: '',
};
const slot: Slot = { startAt: '2026-10-20T14:00:00Z', endAt: '2026-10-20T15:00:00Z' };
const booking: Booking = {
  id: 'booking',
  bookingNumber: 12,
  companyId: 'company',
  resourceId: 'resource',
  customerUserId: 'customer',
  startAt: slot.startAt,
  endAt: slot.endAt,
  status: 'CONFIRMED',
  timezone: 'America/Bogota',
  notes: '',
  cancelledAt: '',
  cancellationReason: '',
  checkedInAt: '',
  checkedInBy: '',
  completedAt: '',
  completedBy: '',
  noShowAt: '',
  noShowBy: '',
};

describe('booking creation component', () => {
  const api = {
    resources: vi.fn(() => of([resource])),
    availability: vi.fn(() => of([slot])),
    create: vi.fn((_input: BookingInput, _key: string) => of(booking)),
  };
  let fixture: ReturnType<typeof TestBed.createComponent<BookingCreatePage>>;

  async function setup(role: 'CUSTOMER' | 'BOOKING_MANAGER') {
    api.resources.mockClear();
    api.resources.mockReturnValue(of([resource]));
    api.availability.mockClear();
    api.availability.mockReturnValue(of([slot]));
    api.create.mockClear();
    api.create.mockReturnValue(of(booking));
    TestBed.configureTestingModule({
      imports: [BookingCreatePage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map() } } },
        { provide: BookingsApi, useValue: api },
        { provide: CONFIG, useValue: { apiBaseUrl: '/api', companyTimezone: 'America/Bogota' } },
        { provide: DialogService, useValue: { confirm: vi.fn(async () => true) } },
      ],
    });
    TestBed.inject(Session).identity.set({
      token: 'test',
      userId: 'customer',
      companyId: 'company',
      roles: [role],
      expiresAt: Date.now() + 60000,
    });
    fixture = TestBed.createComponent(BookingCreatePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  it('shows the customer form, queries exact availability and submits one idempotent payload', async () => {
    await setup('CUSTOMER');
    const page = fixture.componentInstance;
    expect(page.fields.some((field) => field.key === 'customerUserId')).toBe(false);
    const form = page.editor()!.form;
    form.controls['resourceId']!.setValue('resource');
    form.controls['date']!.setValue('2026-10-20');
    form.controls['durationMinutes']!.setValue('60');
    form.controls['notes']!.setValue('Quiet room');

    await page.search(form.getRawValue());
    expect(api.availability).toHaveBeenCalledWith('resource', '2026-10-20', 60);
    expect(page.slots()).toEqual([slot]);
    expect(page.hasUnsavedChanges()).toBe(true);

    await page.reserve(slot);
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create.mock.calls[0]?.[0]).toEqual({
      resourceId: 'resource',
      startAt: slot.startAt,
      endAt: slot.endAt,
      notes: 'Quiet room',
    });
    expect(api.create.mock.calls[0]?.[1]).toMatch(/^[\da-f-]{36}$/);
    expect(page.hasUnsavedChanges()).toBe(false);
  });

  it('invalidates available slots when the selected date changes', async () => {
    await setup('CUSTOMER');
    const page = fixture.componentInstance;
    const form = page.editor()!.form;
    form.patchValue({ resourceId: 'resource', date: '2026-10-20', durationMinutes: '60' });
    await page.search(form.getRawValue());
    form.controls['date']!.setValue('2026-10-21');
    fixture.nativeElement
      .querySelector('#availability-date')
      .dispatchEvent(new Event('input', { bubbles: true }));
    expect(page.slots()).toEqual([]);
    await page.reserve(slot);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('uses edited notes without repeating the availability query', async () => {
    await setup('CUSTOMER');
    const page = fixture.componentInstance;
    const form = page.editor()!.form;
    form.patchValue({
      resourceId: 'resource',
      date: '2026-10-20',
      durationMinutes: '60',
      notes: 'Original',
    });
    await page.search(form.getRawValue());
    form.controls['notes']!.setValue('Updated');
    fixture.nativeElement
      .querySelector('#availability-notes')
      .dispatchEvent(new Event('input', { bubbles: true }));
    await page.reserve(slot);
    expect(api.create.mock.calls[0]?.[0].notes).toBe('Updated');
    expect(api.availability).toHaveBeenCalledTimes(1);
  });

  it('offers customer assignment only to staff', async () => {
    await setup('BOOKING_MANAGER');
    expect(fixture.componentInstance.fields.some((field) => field.key === 'customerUserId')).toBe(
      true,
    );
  });
});

describe('booking calendar date validation', () => {
  it('rejects an impossible end date before requesting bookings', () => {
    const api = { list: vi.fn(), resources: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BookingsApi, useValue: api },
        { provide: CONFIG, useValue: { companyTimezone: 'America/Bogota' } },
        {
          provide: Session,
          useValue: { identity: () => ({ userId: 'customer' }), staff: () => false },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { calendar: true },
              queryParamMap: convertToParamMap({ from: '2026-02-01', to: '2026-02-31' }),
            },
          },
        },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new BookingsPage());
    expect(api.list).not.toHaveBeenCalled();
    expect(page.error()).not.toBeNull();
    expect(page.loading()).toBe(false);
  });
});
