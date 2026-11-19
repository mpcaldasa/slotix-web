import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BookingCalendar } from './booking-calendar';
import type { Resource } from '../../core/models';
function resource(id: string): Resource {
  return {
    id,
    companyId: 'company',
    name: 'Court ' + id,
    description: '',
    resourceType: 'SPACE',
    capacity: 1,
    status: 'ACTIVE',
    visibility: 'MEMBERS',
    createdAt: '',
    updatedAt: '',
  };
}
describe('resource calendar', () => {
  it('uses resource columns and clamps their page after a filter narrows the catalog', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(BookingCalendar);
    const calendar = fixture.componentInstance;
    fixture.componentRef.setInput('bookings', []);
    fixture.componentRef.setInput(
      'resources',
      Array.from({ length: 6 }, (_, i) => resource(String(i))),
    );
    fixture.componentRef.setInput('from', '2026-11-21');
    fixture.componentRef.setInput('to', '2026-11-27');
    calendar.showResources();
    expect(calendar.mode()).toBe('day');
    expect(calendar.days().map((day) => day.name)).toHaveLength(4);
    calendar.resourcePage.set(1);
    expect(calendar.days()).toHaveLength(2);
    fixture.componentRef.setInput('resources', [resource('0')]);
    expect(calendar.days().map((day) => day.name)).toEqual(['Court 0']);
    calendar.changeMode('week');
    expect(calendar.resourceView()).toBe(false);
  });
});
