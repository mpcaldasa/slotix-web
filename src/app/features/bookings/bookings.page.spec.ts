import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CONFIG } from '../../core/config';
import { Session } from '../../core/session';
import type { Booking, BookingInput, Resource, Slot } from '../../core/models';
import { DialogService } from '../../shared/dialog';
import { BookingsApi } from './bookings-api';
import { BookingCreatePage } from './bookings.page';

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

  it('offers customer assignment only to staff', async () => {
    await setup('BOOKING_MANAGER');
    expect(fixture.componentInstance.fields.some((field) => field.key === 'customerUserId')).toBe(
      true,
    );
  });
});
