// Capture real DataHub responses for St James's Park as test fixtures.
// Usage: DATAHUB_API_KEY=... npm run capture-fixtures
import { writeFile } from 'node:fs/promises';
import { config } from '../src/lib/config';
import { fetchWithRetry } from './http';

const key = process.env.DATAHUB_API_KEY?.trim();
if (!key) {
  console.error('Set DATAHUB_API_KEY first.');
  process.exit(1);
}
const d = config.station.datahub;
const headers = { apikey: key, accept: 'application/json' };
const nearest = await (await fetchWithRetry(`${d.baseUrl}/nearest?lat=${d.nearestQueryLatitude}&lon=${d.nearestQueryLongitude}&max=5`, { headers })).json();
await writeFile('tests/fixtures/datahub/st-jamess-park-nearest.json', JSON.stringify(nearest, null, 2) + '\n');
const geohash = (nearest as Array<{ geohash: string }>)[0]?.geohash;
if (!geohash) throw new Error('No station returned');
const obs = await (await fetchWithRetry(`${d.baseUrl}/${geohash}`, { headers })).json();
await writeFile('tests/fixtures/datahub/st-jamess-park-observations.json', JSON.stringify(obs, null, 2) + '\n');
console.log(`Saved nearest (${geohash}) and ${(obs as unknown[]).length} observations to tests/fixtures/datahub/.`);
