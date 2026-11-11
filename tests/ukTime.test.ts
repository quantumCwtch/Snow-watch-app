import { describe, it, expect } from 'vitest';
import { ukDateOf, ukDayBoundsUtc, hoursInUkDay, utcHoursOfUkDay, ukOffsetMinutes, addDays, isValidDate } from '../src/lib/ukTime';
import { sunTimes, isNight } from '../src/lib/sun';

describe('UK time', () => {
  it('handles GMT and BST offsets', () => {
    expect(ukOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(0);
    expect(ukOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(60);
  });

  it('maps instants near midnight to the right UK date', () => {
    expect(ukDateOf(new Date('2026-07-15T23:30:00Z'))).toBe('2026-07-16'); // 00:30 BST
    expect(ukDateOf(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-15');
  });

  it('computes day bounds', () => {
    expect(ukDayBoundsUtc('2026-07-15').start.toISOString()).toBe('2026-07-14T23:00:00.000Z');
    expect(ukDayBoundsUtc('2026-01-15').start.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('day lengths on clock-change days', () => {
    expect(hoursInUkDay('2026-03-29')).toBe(23);
    expect(hoursInUkDay('2026-10-25')).toBe(25);
    expect(hoursInUkDay('2026-11-10')).toBe(24);
    expect(utcHoursOfUkDay('2026-03-29')[0]).toBe('2026-03-29T00:00:00Z');
    expect(utcHoursOfUkDay('2026-03-30')[0]).toBe('2026-03-29T23:00:00Z');
  });

  it('date arithmetic and validation', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-02-28')).toBe(true);
  });
});

describe('sun', () => {
  it('London sunset times are plausible', () => {
    const lat = 51.508, lon = -0.1281;
    const winter = sunTimes(new Date('2026-12-21T12:00:00Z'), lat, lon);
    expect(winter.sunset!.toISOString().slice(11, 16)).toMatch(/^15:5\d$/);
    const summer = sunTimes(new Date('2026-06-21T12:00:00Z'), lat, lon);
    expect(summer.sunset!.toISOString().slice(11, 16)).toMatch(/^20:2\d$/); // 21:2x BST
    expect(isNight(new Date('2026-12-21T18:00:00Z'), lat, lon)).toBe(true);
    expect(isNight(new Date('2026-12-21T12:00:00Z'), lat, lon)).toBe(false);
  });
});
