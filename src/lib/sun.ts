// Sunrise and sunset for a location, calculated locally (no API) using the
// NOAA solar position equations. Accuracy is within a minute or two, which is
// plenty for choosing a day or night scene.

const RAD = Math.PI / 180;

function julianDay(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

/** Returns sunrise and sunset as Date instants for the UTC calendar day containing `date`. */
export function sunTimes(date: Date, lat: number, lon: number): { sunrise: Date | null; sunset: Date | null } {
  const noonUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
  const n = Math.round(julianDay(new Date(noonUtc)) - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const decl = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD));
  const cosH =
    (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
  if (cosH > 1 || cosH < -1) return { sunrise: null, sunset: null };
  const H = Math.acos(cosH) / RAD;
  const toDate = (j: number) => new Date((j - 2440587.5) * 86400000);
  return { sunrise: toDate(jTransit - H / 360), sunset: toDate(jTransit + H / 360) };
}

export function isNight(at: Date, lat: number, lon: number): boolean {
  const { sunrise, sunset } = sunTimes(at, lat, lon);
  if (!sunrise || !sunset) return false;
  return at < sunrise || at > sunset;
}
