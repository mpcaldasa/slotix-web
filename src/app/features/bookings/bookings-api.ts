import { inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import type { Booking, BookingInput, Resource, Slot } from '../../core/models';
@Injectable({ providedIn: 'root' })
export class BookingsApi {
  private readonly api = inject(Api);
  list(from: string, to: string, calendar = false) {
    return this.api.get<Booking[]>(calendar ? '/v1/calendar' : '/v1/bookings', { from, to });
  }
  detail(id: string) {
    return this.api.get<Booking>(`/v1/bookings/${encodeURIComponent(id)}`);
  }
  resources() {
    return this.api.get<Resource[]>(this.api.companyPath('/resources'));
  }
  availability(resourceId: string, date: string, durationMinutes: number) {
    return this.api.get<Slot[]>(
      this.api.companyPath(`/resources/${encodeURIComponent(resourceId)}/availability`),
      { date, durationMinutes },
    );
  }
  create(input: BookingInput, key: string) {
    return this.api.post<Booking>('/v1/bookings', input, key);
  }
  cancel(id: string, reason?: string) {
    return this.api.post<Booking>(
      `/v1/bookings/${encodeURIComponent(id)}/cancel`,
      reason ? { reason } : {},
    );
  }
  action(id: string, action: 'approve' | 'reject' | 'check-in' | 'complete' | 'no-show') {
    return this.api.post<Booking>(`/v1/bookings/${encodeURIComponent(id)}/${action}`);
  }
  reschedule(id: string, startAt: string, endAt: string) {
    return this.api.put<Booking>(`/v1/bookings/${encodeURIComponent(id)}/reschedule`, {
      startAt,
      endAt,
    });
  }
}
