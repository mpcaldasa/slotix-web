import { calendarDate, calendarEvents, denseCalendarGroups } from './calendar-layout';
import type { Booking } from '../../core/models';

const booking = (id: string, startAt: string, endAt: string) => ({ id, startAt, endAt }) as Booking;
describe('calendar event layout', () => {
  it('gives overlapping bookings separate lanes and reuses a lane at an exact boundary', () => {
    const rows = calendarEvents(
      [
        booking('a', '2026-11-21T13:00:00Z', '2026-11-21T14:00:00Z'),
        booking('b', '2026-11-21T13:30:00Z', '2026-11-21T14:30:00Z'),
        booking('c', '2026-11-21T14:00:00Z', '2026-11-21T15:00:00Z'),
      ],
      '2026-11-21',
      'America/Bogota',
    );
    expect(rows.map((row) => [row.lane, row.lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 2],
    ]);
    expect(rows[0]?.start).toBe(480);
  });
  it('splits overnight bookings and excludes the exact midnight end from the next day', () => {
    const rows = [booking('a', '2026-11-21T04:00:00Z', '2026-11-21T06:00:00Z')];
    expect(calendarEvents(rows, '2026-11-20', 'America/Bogota')[0]?.end).toBe(1440);
    expect(calendarEvents(rows, '2026-11-21', 'America/Bogota')[0]?.start).toBe(0);
    expect(
      calendarEvents(
        [booking('b', '2026-11-21T04:00:00Z', '2026-11-21T05:00:00Z')],
        '2026-11-21',
        'America/Bogota',
      ),
    ).toEqual([]);
  });
  it('keeps date navigation independent from the browser timezone and crosses leap days', () => {
    expect(calendarDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(calendarDate('2028-02-29', 1)).toBe('2028-03-01');
    expect(calendarEvents([], '2026-11-21', 'America/Bogota')).toEqual([]);
  });

  it('groups dense overlaps for a readable weekly overview without dropping bookings', () => {
    const rows = calendarEvents(
      ['a', 'b', 'c'].map((id) => booking(id, '2026-11-21T13:00:00Z', '2026-11-21T14:00:00Z')),
      '2026-11-21',
      'America/Bogota',
    );
    const groups = denseCalendarGroups(rows);
    expect(groups.length).toBe(1);
    expect(groups[0]?.events.map((event) => event.booking.id)).toEqual(['a', 'b', 'c']);
    expect(groups[0]?.start).toBe(480);
    expect(groups[0]?.end).toBe(540);
  });
});
