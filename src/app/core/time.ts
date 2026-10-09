export function dateInZone(instant: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function formatInstant(instant: string | null | undefined, zone: string): string {
  return instant
    ? new Intl.DateTimeFormat('es-CO', {
        timeZone: zone,
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(instant))
    : '—';
}
// Administrative instant fields require an explicit offset; browser local time is never assumed.
export function explicitInstant(value: string): string {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value)))
    throw new Error('An explicit UTC offset is required');
  return new Date(value).toISOString();
}

export function localDateStart(date: string, zone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error('A valid company-local date is required');
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  let candidate = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(candidate);
    const value = (name: string) => Number(parts.find((part) => part.type === name)?.value);
    const displayed = Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
    );
    const correction = target - displayed;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate);
}
