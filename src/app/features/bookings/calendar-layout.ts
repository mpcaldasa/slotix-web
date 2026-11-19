import type { Booking } from '../../core/models';
import { dateInZone, localDateStart } from '../../core/time';

export function calendarDate(date: string, offset: number): string {
  const result = localDateStart(date, 'UTC');
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}

export function clockMinutes(instant: string, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  return (
    Number(parts.find((p) => p.type === 'hour')?.value) * 60 +
    Number(parts.find((p) => p.type === 'minute')?.value)
  );
}

export interface CalendarEvent {
  booking: Booking;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

export function calendarEvents(bookings: Booking[], date: string, zone: string): CalendarEvent[] {
  const events = bookings
    .flatMap((booking) => {
      const from = dateInZone(booking.startAt, zone),
        to = dateInZone(booking.endAt, zone);
      if (from > date || to < date) return [];
      const start = from < date ? 0 : clockMinutes(booking.startAt, zone);
      const end = to > date ? 1440 : clockMinutes(booking.endAt, zone);
      return end > start ? [{ booking, start, end, lane: 0, lanes: 1 }] : [];
    })
    .sort((a, b) => a.start - b.start || a.end - b.end || a.booking.id.localeCompare(b.booking.id));
  let group: CalendarEvent[] = [],
    ends: number[] = [],
    groupEnd = -1;
  const finishGroup = () => group.forEach((event) => (event.lanes = ends.length));
  for (const event of events) {
    if (event.start >= groupEnd) {
      finishGroup();
      group = [];
      ends = [];
    }
    let lane = ends.findIndex((end) => end <= event.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = event.end;
    event.lane = lane;
    group.push(event);
    groupEnd = Math.max(...ends);
  }
  finishGroup();
  return events;
}

export function denseCalendarGroups(events: CalendarEvent[]) {
  const groups: { start: number; end: number; events: CalendarEvent[] }[] = [];
  for (const event of events.filter((event) => event.lanes > 2)) {
    const last = groups.at(-1);
    if (last && event.start < last.end) {
      last.end = Math.max(last.end, event.end);
      last.events.push(event);
    } else groups.push({ start: event.start, end: event.end, events: [event] });
  }
  return groups;
}
