// Decides which special screen (if any) appears before the daily scene.
import type { LatestSnapshot, Verdict } from '../lib/types';
import type { SpecialScreen } from './screens';

export interface DayVerdictLike {
  verdict: Verdict;
  possibleSnow: boolean;
  hailSeen: boolean;
}

/** Screen for a finalised day's verdict (used for "yesterday" and the archive). */
export function screenForVerdict(d: DayVerdictLike): SpecialScreen | null {
  switch (d.verdict) {
    case 'SNOW':
      return 'snow-day';
    case 'SLEET':
      return 'sleet';
    case 'UNCONFIRMED':
      return d.possibleSnow ? 'possible-snow' : 'unconfirmed';
    case 'NO_DATA':
      return 'signal-lost';
    case 'NO_SNOW':
      return d.hailSeen ? 'hail' : null;
  }
}

export interface Intro {
  screen: SpecialScreen | null;
  /** Date shown on the screen. */
  date: string;
  /** If true the screen cannot be dismissed (nothing trustworthy to show behind it). */
  blocking: boolean;
  /** Force the snow scene after dismissal. */
  snowScene: boolean;
  /** Extra line for the screen (where snow was confirmed, or seen nearby). */
  note?: string;
}

const CONFIRMED_NEARBY = 'CONFIRMED BY NEARBY SNOW SENSOR';
const SEEN_NEARBY = 'SNOW SEEN NEARBY';

export function decideIntro(latest: LatestSnapshot): Intro {
  if (latest.status === 'STATION_MISMATCH') return { screen: 'station-mismatch', date: '', blocking: true, snowScene: false };
  if (latest.status === 'SIGNAL_LOST' || !latest.today) {
    return { screen: 'signal-lost', date: latest.today?.date ?? '', blocking: !latest.today, snowScene: false };
  }
  // Confirmed snow (yesterday's final verdict, or a snow code reported today so far).
  if (latest.today.verdict === 'SNOW') {
    return { screen: 'snow-day', date: latest.today.date, blocking: false, snowScene: true, note: latest.today.rule.confirmedBy === 'nearby' ? CONFIRMED_NEARBY : undefined };
  }
  if (latest.yesterday?.verdict === 'SNOW') {
    return { screen: 'snow-day', date: latest.yesterday.date, blocking: false, snowScene: true, note: latest.yesterday.confirmedBy === 'nearby' ? CONFIRMED_NEARBY : undefined };
  }
  if (latest.yesterday) {
    const s = screenForVerdict(latest.yesterday);
    if (s && s !== 'signal-lost') {
      return { screen: s, date: latest.yesterday.date, blocking: false, snowScene: false, note: s === 'unconfirmed' && latest.yesterday.nearbySnow ? SEEN_NEARBY : undefined };
    }
  }
  if (latest.today.rule.possibleSnow) return { screen: 'possible-snow', date: latest.today.date, blocking: false, snowScene: false };
  return { screen: null, date: latest.today.date, blocking: false, snowScene: false };
}
