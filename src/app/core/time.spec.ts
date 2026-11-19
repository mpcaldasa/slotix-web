import { dateInZone, explicitInstant, formatInstant, localDateStart } from './time';
describe('explicit reservation timezone', () => {
  it('keeps local company dates across UTC midnight', () => {
    expect(dateInZone('2026-10-09T02:00:00Z', 'America/Bogota')).toBe('2026-10-08');
    expect(dateInZone('2026-10-09T02:00:00Z', 'Asia/Tokyo')).toBe('2026-10-09');
  });
  it('requires offset instead of silently assuming browser time', () => {
    expect(() => explicitInstant('2026-10-09T10:00')).toThrow();
    expect(() => explicitInstant('invalidZ')).toThrow();
    expect(explicitInstant('2026-10-09T10:00:00-05:00')).toBe('2026-10-09T15:00:00.000Z');
    expect(formatInstant(null, 'America/Bogota')).toBe('—');
  });
});

describe('calendar date validation', () => {
  it('rejects nonexistent dates instead of moving them into another month', () => {
    expect(() => localDateStart('2026-02-31', 'America/Bogota')).toThrow();
    expect(() => localDateStart('2026-13-01', 'America/Bogota')).toThrow();
    expect(localDateStart('2028-02-29', 'America/Bogota').toISOString()).toBe(
      '2028-02-29T05:00:00.000Z',
    );
  });
});
