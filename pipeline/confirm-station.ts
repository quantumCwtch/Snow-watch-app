// One-off: ask DataHub for the stations nearest Trafalgar Square, confirm the
// nearest is St James's Park, and store its geohash in config/snow-watch.json.
// Usage: DATAHUB_API_KEY=... npm run confirm-station
import { readFile, writeFile } from 'node:fs/promises';
import { fetchDatahubNearest } from './sources';
import { datahubAreaMatches } from './parsers';

const key = process.env.DATAHUB_API_KEY?.trim();
if (!key) {
  console.error('Set DATAHUB_API_KEY first.');
  process.exit(1);
}

const stations = await fetchDatahubNearest(key, 5);
console.log('Nearest DataHub stations to Trafalgar Square (51.51, -0.13):');
stations.forEach((s, i) => console.log(`  ${i + 1}. ${s.area} [${s.geohash}] ${s.region ?? ''} ${s.country ?? ''}`));

const first = stations[0];
if (!first || !datahubAreaMatches(first.area)) {
  console.error(
    `\nSTOP: the nearest station is "${first?.area ?? 'none'}", not St James's Park. ` +
      'Nothing was written. Do not substitute another station; report this instead.',
  );
  process.exit(2);
}

const path = 'config/snow-watch.json';
const cfg = JSON.parse(await readFile(path, 'utf8'));
cfg.station.datahub.confirmedGeohash = first.geohash;
await writeFile(path, JSON.stringify(cfg, null, 2) + '\n');
console.log(`\nConfirmed: "${first.area}" -> geohash ${first.geohash} saved to ${path}.`);
