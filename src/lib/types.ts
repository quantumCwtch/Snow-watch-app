// Shared data shapes used by the pipeline (Node) and the front end (browser).

/** One merged hourly observation for St James's Park, keyed by the UTC hour. */
export interface HourlyObs {
  /** ISO timestamp of the observation hour in UTC, e.g. 2026-11-10T14:00:00Z */
  time: string;
  /** Met Office weather type code (DataHub `weather_code`), null when not reported. */
  weatherCode: number | null;
  /** Air temperature in °C at the hour. */
  temperatureC: number | null;
  /** Lowest one-minute temperature during the preceding hour (AWS only). */
  minTemperatureC?: number | null;
  /** Highest one-minute temperature during the preceding hour (AWS only). */
  maxTemperatureC?: number | null;
  /** Visibility in metres (DataHub). */
  visibilityM: number | null;
  /** Mean wind speed in m/s (DataHub). */
  windSpeedMs: number | null;
  /** Gust speed in m/s (DataHub). */
  windGustMs: number | null;
  /** 16-point compass direction the wind blows from (DataHub). */
  windDirection: string | null;
  /** Relative humidity in %. */
  humidityPct: number | null;
  /** Mean sea-level pressure in hPa (DataHub). */
  mslpHpa: number | null;
  /** Precipitation total in mm for the hour ending at `time` (AWS one-minute totals). */
  precipMm: number | null;
  /** Which sources contributed to this hour. */
  sources: SourceId[];
}

export type SourceId = 'datahub' | 'aws';

export type Verdict = 'SNOW' | 'SLEET' | 'UNCONFIRMED' | 'NO_SNOW' | 'NO_DATA';

export interface SnowTrigger {
  time: string;
  localTime: string;
  /** Met Office weather code (St James's Park), or -999 for a nearby-station report. */
  code: number;
  label: string;
  /** Set when the trigger came from a nearby confirmation station. */
  station?: string;
  /** Raw present-weather groups from the nearby station, e.g. "-SN". */
  wx?: string;
}

/** A present-weather report from a nearby confirmation station (Heathrow, Northolt, London City). */
export interface NearbyReport {
  stationId: string;
  stationName: string;
  /** ISO time of the report (UTC). */
  time: string;
  /** Aviation-style weather groups ("NSW" = no significant weather), or null if unavailable. */
  wx: string | null;
}

export type ConfirmedBy = 'st-jamess-park' | 'nearby' | null;

export interface SnowRuleResult {
  verdict: Verdict;
  /** Hours and codes that triggered the verdict (snow, sleet or hail codes seen). */
  triggers: SnowTrigger[];
  /** Hail codes seen (hail is not snow but gets its own comedic message). */
  hailSeen: boolean;
  sleetSeen: boolean;
  /** True when UNCONFIRMED and precipitation fell at or below the cold threshold. */
  possibleSnow: boolean;
  /** Hours where precipitation fell at or below the possible-snow temperature. */
  possibleSnowHours: string[];
  /** Hours that had no weather code but could plausibly have hidden snow. */
  relevantMissingCodeHours: string[];
  /** Codes above the documented range (possible scheme change). */
  unexpectedCodes: number[];
  /** Where a SNOW or SLEET verdict was confirmed. */
  confirmedBy: ConfirmedBy;
  /** Hours (UTC) when a nearby station reported snow (confirmed or not). */
  nearbySnowHours: string[];
  /** Hours of the day covered by at least one nearby present-weather report. */
  nearbyCoverageHours: number;
  reasons: string[];
}

export type SceneCategory =
  | 'snow'
  | 'sleet-hail'
  | 'thunder'
  | 'heavy-rain'
  | 'light-rain'
  | 'fog'
  | 'wind'
  | 'overcast'
  | 'partly-cloudy'
  | 'sunny'
  | 'unknown';

export type SceneVariant = 'normal' | 'hot' | 'cold-bright';

export interface Classification {
  category: SceneCategory;
  variant: SceneVariant;
  /** Short plain-English label for the HUD. */
  label: string;
  /** Why this category was chosen. */
  basis: string;
}

export interface Completeness {
  hoursExpected: number;
  hoursReceived: number;
  hoursWithCode: number;
}

export interface CrossCheck {
  comparedHours: number;
  maxTemperatureDifferenceC: number | null;
  hoursOutsideTolerance: string[];
  ok: boolean;
}

/** A finalised (or provisional) day summary. Stored in data/days/YYYY-MM-DD.json. */
export interface DayRecord {
  schema: 1;
  date: string;
  provisional: boolean;
  verdict: Verdict;
  rule: SnowRuleResult;
  scene: Classification;
  minTemperatureC: number | null;
  maxTemperatureC: number | null;
  totalPrecipMm: number | null;
  completeness: Completeness;
  sources: SourceId[];
  crossCheck: CrossCheck | null;
  station: StationIdentity;
  retrievedAt: string;
  hourly: HourlyObs[];
  raw: {
    datahub: unknown[] | null;
    aws: AwsRawMinutes | null;
    /** Nearby present-weather reports as runs: [stationId, firstTime, lastTime, wx]. */
    nearby?: Array<[string, string, string, string | null]>;
    /** Raw METAR text from London City Airport for the day. */
    metar?: string[];
  };
}

export interface StationIdentity {
  name: string;
  wmoId: string;
  datahubGeohash: string | null;
  datahubArea: string | null;
  awsName: string | null;
  verified: { datahub: boolean; aws: boolean };
}

/** Compact columnar store of the raw AWS one-minute values used. */
export interface AwsRawMinutes {
  objectKeys: string[];
  columns: string[];
  rows: Array<Array<string | number | null>>;
}

export type FeedStatus = 'OK' | 'PARTIAL' | 'SIGNAL_LOST' | 'STATION_MISMATCH';

export interface LatestSnapshot {
  schema: 1;
  generatedAt: string;
  status: FeedStatus;
  statusMessage: string;
  station: StationIdentity;
  latestObservation: HourlyObs | null;
  today: {
    date: string;
    verdict: Verdict;
    rule: SnowRuleResult;
    scene: Classification;
    minTemperatureC: number | null;
    maxTemperatureC: number | null;
    totalPrecipMm: number | null;
    completeness: Completeness;
    sources: SourceId[];
  } | null;
  yesterday: {
    date: string;
    verdict: Verdict;
    possibleSnow: boolean;
    hailSeen: boolean;
    confirmedBy?: ConfirmedBy;
    nearbySnow?: boolean;
    scene: Classification;
    dayFile: string;
  } | null;
  snowDaysRecorded: number;
}

export interface SummaryDay {
  date: string;
  verdict: Verdict;
  possibleSnow: boolean;
  hailSeen: boolean;
  confirmedBy?: ConfirmedBy;
  nearbySnow?: boolean;
  category: SceneCategory;
  variant: SceneVariant;
  minTemperatureC: number | null;
  maxTemperatureC: number | null;
  completeness: number;
}

export interface Summary {
  schema: 1;
  generatedAt: string;
  launchDate: string | null;
  counts: Record<Verdict, number>;
  snowDays: string[];
  sleetDays: string[];
  longestRunWithoutSnow: { days: number; from: string | null; to: string | null };
  currentRunWithoutSnow: number;
  days: SummaryDay[];
}
