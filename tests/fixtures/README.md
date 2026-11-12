# Test fixtures

All fixtures are real data, downloaded on 2026-11-11 and 2026-11-12.

| File | Provenance |
| --- | --- |
| `aws/2026-11-10/*.csv` | Real St James's Park one-minute observations for the whole of 10 November 2026 (24 objects) from `s3://met-office-land-observations-data`. File names are the object prefixes (`published_start_end`). © Crown copyright, Met Office, CC BY-SA. |
| `aws/heathrow/*.csv` | Two real hours of Heathrow one-minute data (6 and 9 November 2026) whose present-weather column includes `UP`, `+UP`, `RERA`, `-RA`, `-DZ` and `FG`. © Crown copyright, Met Office, CC BY-SA. |
| `metar/eglc-48h.json` | Real London City Airport METAR response (96 reports, 48 hours to 07:00Z on 12 November 2026) from `https://aviationweather.gov/api/data/metar?ids=EGLC&format=json&hours=48`. |
| `datahub/official-sample-nearest.json` | Official Met Office sample response for `GET /observation-land/1/nearest` (a Devon station), from datahub.metoffice.gov.uk. |
| `datahub/official-sample-observations.json` | Official Met Office sample response for `GET /observation-land/1/{geohash}`, from datahub.metoffice.gov.uk. |
| `datahub/land_obs_openapi_spec.json` | The official Land Observations OpenAPI definition (`/downloads/api-definitions/land_obs_subscriber.json`). |

**To do once a DataHub API key is available:** run `npm run capture-fixtures` to save real St James's Park responses (`st-jamess-park-*.json`). Then add a test confirming the station's `area` name and checking that its `weather_code` values follow the Definition of Codes table (-1 to 30).
