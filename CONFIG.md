# Configuration reference

Every threshold and code mapping lives in [`config/snow-watch.json`](config/snow-watch.json). Both the data pipeline and the front end read this file. Change values there, not in code.

## Site and station

| Key | Value | Source / reason |
| --- | --- | --- |
| `site.latitude`, `site.longitude` | 51.508, -0.1281 | Trafalgar Square. Also used for the local sunset calculation. |
| `station.wmoId` | 03770 | London, St James's Park, the closest official Met Office station (about 600 m away). |
| `station.datahub.nearestQueryLatitude` / `Longitude` | 51.51, -0.13 | The DataHub `/nearest` endpoint accepts at most 2 decimal places (Land Observations OpenAPI spec, `tests/fixtures/datahub/land_obs_openapi_spec.json`). |
| `station.datahub.expectedAreaPattern` | `st\.?\s*james` (case-insensitive) | The `area` returned by `/nearest` must match this pattern, or the run stops and nothing is published. |
| `station.datahub.confirmedGeohash` | `null` (to be confirmed) | Set by `npm run confirm-station` once a DataHub key is available. Once set, the nearest-station geohash must equal it on every run. |
| `station.aws.expectedName` | `London St Jamess Park Automatic Weather Station` | The exact `name` column in the real AWS files (checked 2026-11-11). |
| `station.aws.expectedLatitude` / `Longitude` / `maxCoordinateDifferenceDegrees` | 51.5, -0.13, 0.02 | The coordinates in the real AWS files. Rows from any other location are rejected. |

## Weather type codes

Source: Met Office Weather DataHub, [Definition of Codes](https://datahub.metoffice.gov.uk/definition-of-codes), checked 2026-11-11. The Land Observations API spec describes `weather_code` as the "numerical code for the weather symbol", and the official sample response uses 7 and 8 (cloudy and overcast), which matches this table.

The DataHub glossary entry for the observations `weather_code` parameter also mentions "the international SYNOP code" (a 00 to 99 scheme). The pipeline therefore treats any code outside -1 to 30 as **unexpected**. Such a code can never produce SNOW, and it marks the hour as UNCONFIRMED. This check should be confirmed against real St James's Park responses once a DataHub key is available.

| Group | Codes | Meaning |
| --- | --- | --- |
| `snow` | 22 to 27 | Light snow shower (night/day), light snow, heavy snow shower (night/day), heavy snow |
| `sleet` | 16 to 18 | Sleet shower (night/day), sleet |
| `hail` | 19 to 21 | Hail shower (night/day), hail |
| `thunder` | 28 to 30 | Thunder shower (night/day), thunder |
| `heavyRain` | 13 to 15 | Heavy rain shower (night/day), heavy rain |
| `lightRain` | -1, 9 to 12 | Trace rain, light rain shower (night/day), drizzle, light rain |
| `fog` | 5, 6 | Mist, fog |
| `overcast` | 7, 8 | Cloudy, overcast |
| `partlyCloudy` | 2, 3 | Partly cloudy (night/day) |
| `clear` | 0, 1 | Clear night, sunny day |
| `maxKnownCode` | 30 | Highest code in the table |

## Snow rule (`snowRule`)

| Key | Value | Meaning |
| --- | --- | --- |
| `possibleSnowMaxTempC` | 2.0 | Precipitation with the temperature at or below this (hourly reading or the hour's one-minute minimum) raises "POSSIBLE SNOW, AWAITING CONFIRMATION" on an UNCONFIRMED day. Value from the project brief. |
| `possibleSnowMinPrecipMm` | 0.2 | Smallest hourly total that counts as "precipitation recorded". This is the usual resolution of a tipping-bucket gauge. |
| `missingCodeRelevantMaxTempC` | 6.0 | **Interpretation, please review.** An hour with no weather code makes the day UNCONFIRMED only if snow was plausible in that hour, meaning its temperature was at or below this value, or unknown. Lying snow at a screen temperature above about 6 °C is essentially unknown in London. Set this to 99 for the strictest reading, where any missing code makes the day UNCONFIRMED. |
| `minCompletenessForVerdict` | 0.5 | If fewer than this fraction of the day's hours arrived (and there is no snow code), the day is UNCONFIRMED. |

Day boundaries are UK local midnights (`Europe/London`), giving 23-hour and 25-hour days at clock changes. A snow code stamped at exactly the following local midnight also counts for the day just ended.

## Nearby confirmation (`confirmation`)

St James's Park has no present-weather sensor, which was confirmed from the AWS files on 2026-11-11. These nearby official stations do have one:

| Station | Source | Distance from Trafalgar Square | Identity check |
| --- | --- | --- | --- |
| London City Airport (EGLC) | METAR from aviationweather.gov | 12.7 km E | `icaoId` must be EGLC and the coordinates must match within 0.02° |
| Northolt (WMO 03672) | Met Office AWS bucket | 20.7 km WNW | Exact `name` and coordinates, as for St James's Park |
| Heathrow (WMO 03772) | Met Office AWS bucket | 22.5 km W | Exact `name` and coordinates |

| Key | Value | Meaning |
| --- | --- | --- |
| `windowHours` | 1 | A nearby report counts for a St James's Park hour if it falls within this many hours either side of that hour. |
| `snowConfirmMaxTempC` | 2.0 | Nearby snow gives SNOW only if St James's Park measured precipitation (> 0 mm in that hour) with its lowest temperature in the hour at or below this. This is the same value as `possibleSnowMaxTempC`. |
| `sleetConfirmMaxTempC` | 4.0 | Nearby sleet gives SLEET only if St James's Park measured precipitation at or below this. |

A missing-code hour at St James's Park is **resolved**, so it no longer counts towards UNCONFIRMED, when all of these hold:

- at least one nearby station reported present weather during that hour;
- none reported snow within the window;
- none reported unidentified precipitation (`UP`) while St James's Park was wet or at or below `possibleSnowMaxTempC`;
- any cold precipitation at St James's Park is explained by nearby sleet or hail.

If St James's Park has no observation at all for an hour, nearby sensors can resolve it only if they reported no precipitation of any kind.

## Scene classifier (`classifier`)

| Key | Value | Meaning |
| --- | --- | --- |
| `fogVisibilityMetres` | 1000 | Below this is fog (the meteorological definition of fog). |
| `mistVisibilityMetres` | 5000 | Below this, with codes present, is treated as haze or mist. |
| `strongWindGustMs` | 17.0 | Gusts at or above about 38 mph give the strong-wind scene. This is a comedic threshold, not a warning level. |
| `heavyRainHourlyMm` | 4.0 | Hourly total for heavy rain when no code is available (the Met Office describes heavy rain as more than 4 mm/h). |
| `lightRainHourlyMm` | 0.2 | Hourly total for light rain when no code is available. |
| `hotMaxTempC` | 25.0 | Above this, sunny days use the hot variant. |
| `coldBrightMaxTempC` | 5.0 | Below this, sunny days use the cold-and-bright variant. |

## Cross-check and pipeline

| Key | Value | Meaning |
| --- | --- | --- |
| `crossCheck.temperatureToleranceC` | 1.5 | DataHub and AWS hourly temperatures differing by more than this are flagged in the day file. |
| `pipeline.awsRetentionDays` | 7 | The AWS bucket held about 8 days of St James's Park files when checked on 2026-11-11. |
| `pipeline.maxBackfillDays` | 7 | How far back a run will finalise missed days automatically. |
| `pipeline.retryAttempts` / `retryBaseDelayMs` | 4 / 2000 | Exponential backoff: 2 s, 4 s, 8 s. |
| `pipeline.requestTimeoutMs` | 20000 | Per-request timeout. |
