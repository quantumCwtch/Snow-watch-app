// UK civil time helpers. All "calendar day" logic is in Europe/London local time,
// so days are 23 hours long when the clocks go forward (last Sunday in March)
// and 25 hours long when they go back (last Sunday in October).
// Uses only the built-in Intl API, so it works identically in Node and browsers.

const TZ = 'Europe/London';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function localParts(d: Date): LocalParts {
  const out: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(d)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as unknown as LocalParts;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** UK calendar date (YYYY-MM-DD) for an instant. */
export function ukDateOf(d: Date): string {
  const p = localParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** UK local clock time (HH:MM) for an instant. */
export function ukTimeOf(d: Date): string {
  const p = localParts(d);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Offset of UK local time from UTC in minutes at an instant (0 for GMT, 60 for BST). */
export function ukOffsetMinutes(d: Date): number {
  const p = localParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** The UTC instant at which a UK local date starts (local midnight). */
export function ukMidnightUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  // Local midnight is never inside a DST gap in the UK (changes happen at 01:00 UTC).
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const off1 = ukOffsetMinutes(new Date(guess.getTime() - 60 * 60000));
  let t = new Date(guess.getTime() - off1 * 60000);
  const off2 = ukOffsetMinutes(t);
  if (off2 !== off1) t = new Date(guess.getTime() - off2 * 60000);
  return t;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** [start, end) of a UK calendar day as UTC instants. */
export function ukDayBoundsUtc(date: string): { start: Date; end: Date } {
  return { start: ukMidnightUtc(date), end: ukMidnightUtc(addDays(date, 1)) };
}

/** Number of hours in a UK calendar day: 23, 24 or 25. */
export function hoursInUkDay(date: string): number {
  const { start, end } = ukDayBoundsUtc(date);
  return Math.round((end.getTime() - start.getTime()) / 3600000);
}

/**
 * The UTC observation hours that belong to a UK day. An hourly observation
 * stamped HH:00Z is attributed to the UK date in which that instant falls.
 */
export function utcHoursOfUkDay(date: string): string[] {
  const { start, end } = ukDayBoundsUtc(date);
  const out: string[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += 3600000) {
    out.push(new Date(t).toISOString().replace('.000Z', 'Z'));
  }
  return out;
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return addDays(s, 0) === s;
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Normalise an ISO string to whole-second "Z" format used as hour keys. */
export function isoHour(d: Date): string {
  const t = new Date(Math.floor(d.getTime() / 3600000) * 3600000);
  return t.toISOString().replace('.000Z', 'Z');
}
