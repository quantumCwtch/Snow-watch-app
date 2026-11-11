import { describe, it, expect } from 'vitest';
import { classify } from '../src/lib/classifier';
import { day } from './helpers';

const D = '2026-11-10';

describe('weather classifier', () => {
  it('uses the most significant weather, not the average', () => {
    // 23 hours of sunshine and one hour of snow is a snow day.
    const c = classify(day(D, (i) => ({ weatherCode: i === 12 ? 24 : 1 })));
    expect(c.category).toBe('snow');
  });

  it.each([
    [[17], 'sleet-hail'],
    [[20], 'sleet-hail'],
    [[29], 'thunder'],
    [[15], 'heavy-rain'],
    [[11], 'light-rain'],
    [[6], 'fog'],
    [[8], 'overcast'],
    [[3], 'partly-cloudy'],
    [[1], 'sunny'],
  ] as const)('code %j gives %s', (codes, cat) => {
    expect(classify(day(D, (i) => ({ weatherCode: i === 5 ? codes[0] : 1 }))).category).toBe(cat);
  });

  it('priority order: thunder beats heavy rain, rain beats fog, fog beats wind', () => {
    expect(classify(day(D, (i) => ({ weatherCode: i === 1 ? 15 : i === 2 ? 30 : 7 }))).category).toBe('thunder');
    expect(classify(day(D, (i) => ({ weatherCode: i === 1 ? 12 : i === 2 ? 6 : 7 }))).category).toBe('light-rain');
    expect(classify(day(D, (i) => ({ weatherCode: i === 1 ? 6 : 7, windGustMs: 25 }))).category).toBe('fog');
  });

  it('fog from visibility even without a fog code', () => {
    expect(classify(day(D, (i) => ({ weatherCode: 7, visibilityM: i === 7 ? 400 : 15000 }))).category).toBe('fog');
  });

  it('strong wind from gusts over the threshold', () => {
    expect(classify(day(D, (i) => ({ weatherCode: 3, windGustMs: i === 15 ? 21 : 8 }))).category).toBe('wind');
  });

  it('sunny variants', () => {
    expect(classify(day(D, () => ({ weatherCode: 1, temperatureC: 28 }))).variant).toBe('hot');
    expect(classify(day(D, () => ({ weatherCode: 1, temperatureC: 2 }))).variant).toBe('cold-bright');
    expect(classify(day(D, () => ({ weatherCode: 1, temperatureC: 15 }))).variant).toBe('normal');
  });

  it('without codes: rain from measured precipitation, otherwise sky unknown (never snow)', () => {
    expect(classify(day(D, (i) => ({ weatherCode: null, temperatureC: 0, precipMm: i === 3 ? 1.2 : 0 }))).category).toBe('light-rain');
    expect(classify(day(D, (i) => ({ weatherCode: null, precipMm: i === 3 ? 5 : 0 }))).category).toBe('heavy-rain');
    expect(classify(day(D, () => ({ weatherCode: null, precipMm: 0 }))).category).toBe('unknown');
  });

  it('empty input is unknown', () => {
    expect(classify([]).category).toBe('unknown');
  });
});
