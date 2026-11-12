# Snow Watch: Trafalgar Square

Has it snowed at Trafalgar Square? Every day this site gives a verdict from real Met Office observations at **London, St James's Park** (WMO 03770), the official station about 600 m from the square. It presents the answer as an early-90s game title screen, with seven millennials doing whatever suits the day's real weather. When snow is observed, it shouts **SNOW DAY SNOW DAY SNOW DAY!**

The joke only works if the weather is true, so accuracy comes first. The app uses no forecasts and no random weather, and never quietly falls back to another station. Every verdict links to the raw observations behind it.

## What's in the repository

| Path | What it is |
| --- | --- |
| `config/snow-watch.json` | Every threshold and code mapping, documented in [CONFIG.md](CONFIG.md) |
| `src/lib/` | Pure, tested logic: the snow rule, the weather classifier, UK-time handling, the seeded RNG and sunset maths |
| `pipeline/` | The data pipeline (Node and TypeScript) run by GitHub Actions |
| `src/game/` | Canvas renderer (320 x 200), cast, activity tables, special screens, chiptune fanfare and background music |

The seven characters are named Haydn, Sophie, Santi, Rachel, David, Sam and Div. The names rotate one place around the cast each day, so everyone takes a turn at each running gag. A given date always gets the same names.
| `src/pages/`, `*.html` | The four pages: title screen, high scores, level select (archive), how it works |
| `data/` | Published JSON: `latest.json`, `summary.json`, `days/YYYY-MM-DD.json` |
| `tests/` | Vitest unit tests, with real fixtures in `tests/fixtures/` |
| `.github/workflows/` | `observe.yml` (hourly pipeline), `pages.yml` (deploy), `ci.yml` (tests) |

## Setup

### 1. Register for Met Office Weather DataHub

1. Create an account at <https://datahub.metoffice.gov.uk/>.
2. Subscribe to the **Land Observations** product on the free plan (360 calls per 24 hours, resetting at 00:00 UTC). This app uses about 50 calls a day.
3. Copy the API key for that subscription. It is sent in an `apikey` header.

Do not use the old DataPoint service, which the Met Office retired on 1 December 2025.

### 2. Confirm the station (once)

```bash
npm ci
```

```bash
DATAHUB_API_KEY=your-key npm run confirm-station
```

This lists the five stations nearest Trafalgar Square. If the nearest is St James's Park, it stores that station's geohash in `config/snow-watch.json`. If not, it stops without writing anything: report the result rather than switching stations. Commit the config change.

Optionally, save real DataHub responses as test fixtures:

```bash
DATAHUB_API_KEY=your-key npm run capture-fixtures
```

### 3. Add the secret

In the GitHub repository, open **Settings → Secrets and variables → Actions → New repository secret**. Name it `DATAHUB_API_KEY` and paste the key. The key is only ever read by the Actions workflow. It never appears in the front end or in the repository.

Without the secret, the pipeline still runs on the AWS data alone. That data has no weather codes for St James's Park, so days can be NO SNOW or UNCONFIRMED but never SNOW, and the page says so.

### 4. Enable GitHub Pages

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Actions → General → Workflow permissions: Read and write**, so the observe job can commit `data/`.
3. Push to `main`. The `Deploy to GitHub Pages` workflow builds and publishes the site. The `Observe St James's Park` workflow then runs every hour and redeploys whenever the data changes.

You can also run **Observe St James's Park** by hand from the Actions tab. Its optional `backfill_from` input re-finalises days from a given date, within the roughly 7-day window of the AWS bucket.

### Local development

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run pipeline -- --data-dir /tmp/snow-data
```

The last command runs the real pipeline. Behind an HTTPS proxy (as in some cloud sandboxes), use `npm run pipeline:proxy` instead, so Node's `fetch` uses the proxy. Point `--data-dir` somewhere else to avoid touching `data/`. Add `--no-datahub` to force AWS-only, or `--now 2026-11-11T12:00:00Z` to pretend it is another time.

## How the verdict is decided

The rule is in `src/lib/snowRule.ts`, a pure function covered by `tests/snowRule.test.ts`. Days are **UK calendar days** (Europe/London, so 23 or 25 hours long when the clocks change).

1. **SNOW**: any hourly observation that day has a snow weather code (22 to 27). A snow code at exactly the following local midnight also counts.
   Or: a nearby present-weather sensor (London City Airport, Northolt or Heathrow) reports falling snow, and within an hour St James's Park itself measured precipitation at 2 °C or below. This is recorded as "confirmed nearby".
2. **UNCONFIRMED**: no snow, but snow cannot be ruled out. Either codes are missing for hours where snow was plausible (temperature at or below 6 °C, or unknown) and no nearby sensor report settles them, or under half the hours arrived. If precipitation fell at or below 2 °C, the page shows "POSSIBLE SNOW, AWAITING CONFIRMATION". The AWS data is used for this check (precipitation and one-minute temperatures).
3. **SLEET**: the only wintry weather was sleet: a sleet code (16 to 18), or sleet nearby with precipitation at St James's Park at 4 °C or below. Shown as a "SO CLOSE" near miss.
4. **NO SNOW**: otherwise. Hail (19 to 21) gets its own "HAIL IS NOT SNOW" message.
5. **NO DATA**: nothing was received (shown as SIGNAL LOST).

Codes follow the DataHub [Definition of Codes](https://datahub.metoffice.gov.uk/definition-of-codes) table. Each day file stores the verdict, the triggering hours and codes, the minimum and maximum temperature, total precipitation, completeness (hours received and expected, and hours with a code), the sources, a DataHub/AWS temperature cross-check, the retrieval time, and the raw observations.

The scene uses the **most significant** weather observed that day, not the average. The order is snow, sleet or hail, thunder, heavy rain, light rain, fog, strong wind, overcast, partly cloudy, then sunny (with hot and cold-and-bright variants). Night versions are used after the locally calculated London sunset. Without weather codes, rain comes from measured precipitation and the sky is shown as "not reported".

## Data sources

- **Primary: Met Office Weather DataHub, Land Observations API** (`https://data.hub.api.metoffice.gov.uk/observation-land/1`). Hourly observations for 48 hours. The field names (`datetime`, `weather_code`, `temperature`, `visibility`, `wind_speed`, `wind_gust`, `wind_direction`, `humidity`, `mslp`, `pressure_tendency`) were taken from the official OpenAPI spec and sample responses, saved in `tests/fixtures/datahub/`.
- **Secondary: Met Office UK Land Surface Observations, AWS Open Data Registry** (`s3://met-office-land-observations-data`, eu-west-2, read anonymously over HTTPS). One-minute, pipe-separated CSV files, one per station per hour, kept for about a week. The parser was built against real St James's Park files (`tests/fixtures/aws/2026-11-10/`).

**Important finding:** the AWS files for St James's Park carry only temperature, precipitation, humidity and ground/soil temperatures. They have **no present-weather code, wind or visibility**, which was checked across every file in the bucket on 2026-11-11. St James's Park has no sensor that can tell snow from rain, so DataHub's weather code for it is probably always empty (to be confirmed once a key is added).

- **Snow confirmation: nearby present-weather sensors.**
  - **London City Airport** (EGLC, about 13 km east): METAR reports from NOAA's Aviation Weather Center API (`https://aviationweather.gov/api/data/metar?ids=EGLC&format=json&hours=N`). No key is needed, and about 8 days of history are available. The real sample is in `tests/fixtures/metar/`.
  - **Northolt** (about 21 km) and **Heathrow** (about 22 km): Met Office one-minute files from the same AWS bucket. Their `present_weather_1_minute_10_minute_weighted_mean` column uses aviation codes such as `NSW`, `BR`, `-RA`, `RERA` and `UP`. A real sample is in `tests/fixtures/aws/heathrow/`.
  - The codes are parsed in `src/lib/presentWeather.ts`:
    - `SN`, `SG` and recent snow (`RESN`) count as snow.
    - Rain and snow mixed (`RASN`), and ice pellets (`PL`), count as sleet.
    - `GR` and `GS` count as hail.
    - Blowing or drifting snow (`BLSN`, `DRSN`) and vicinity groups (`VC...`) are ignored.
    - `UP` (unidentified precipitation) is treated as unknown.
  - Nearby reports are stored in every day file (`raw.nearby` as runs, `raw.metar` as raw text) for traceability.

- **Historical context (not implemented yet):** MIDAS Open via CEDA (Open Government Licence) is quality-controlled but published with a delay. It would suit a future "past snow days" feature.

## Preview mode

Add `?preview=<name>` to the title screen to see any scene or special screen with sample data, clearly watermarked **PREVIEW**. Preview mode never reads or writes the real data files. Add `&night=1` for the night version.

`snow` (the SNOW DAY alert, then the snow scene), `sleet`, `hail`, `thunder`, `heavy-rain`, `light-rain`, `fog`, `wind`, `overcast`, `partly-cloudy`, `sunny`, `sunny-hot`, `cold-bright`, `unknown`, `unconfirmed`, `possible-snow`, `signal-lost`, `station-mismatch`.

## Accessibility

- All game text is also on the page as real text: verdicts, observations, and a list of what each character is doing.
- The canvas has a text alternative, and PRESS START is a real, keyboard-focusable button.
- `prefers-reduced-motion` shows static frames, with no flashing, shaking or animation.
- Colour cycling on the SNOW DAY screen changes at most twice a second, and lightning flashes at most once every 6 seconds. Both are well under the three-flashes-per-second limit.
- Sound is off by default, with a visible toggle. Turning it on plays an original lo-fi chiptune loop ("Pigeons at Dusk", synthesised in `src/game/music.ts`, no audio files) plus the SNOW DAY fanfare. The setting is remembered, and the music resumes on the first click or key press of a later visit, because browsers block autoplay.
- Lighthouse accessibility score: 100 on all four pages, checked locally on 2026-11-11.

## Licences and attribution

- **Code:** MIT (see `LICENSE`).
- **Met Office Weather DataHub data:** © Crown copyright, Met Office, used under the Weather DataHub terms and conditions.
- **Met Office UK Land Surface Observations (AWS Open Data Registry):** British Crown copyright, Met Office, licensed under **CC BY-SA**. See <https://registry.opendata.aws/met-office-uk-land-observations/>. Derived files in `data/` are shared under the same licence.
- **Artwork, characters, pixel font, chiptune fanfare and background music:** original to this project. They do not imitate or reference any existing game, character, publisher or soundtrack.
