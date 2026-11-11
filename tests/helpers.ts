import type { HourlyObs } from '../src/lib/types';
import { utcHoursOfUkDay } from '../src/lib/ukTime';

export function obs(time: string, over: Partial<HourlyObs> = {}): HourlyObs {
  return {
    time,
    weatherCode: 7,
    temperatureC: 8,
    visibilityM: 20000,
    windSpeedMs: 3,
    windGustMs: 6,
    windDirection: 'SW',
    humidityPct: 80,
    mslpHpa: 1012,
    precipMm: 0,
    sources: ['datahub', 'aws'],
    ...over,
  };
}

/** A full UK day of hourly observations, with per-hour overrides by local index. */
export function day(date: string, over: (i: number, time: string) => Partial<HourlyObs> = () => ({})): HourlyObs[] {
  return utcHoursOfUkDay(date).map((t, i) => obs(t, over(i, t)));
}
