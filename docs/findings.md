# Findings: Bugs, Security Issues, and Inconsistencies

## Status Update (2026-08-03)

The functional bugs below (BUG-1, BUG-4, BUG-5) were fixed in the working tree after this document was originally written — `fetchTrains` now re-throws (see `src/services/fgcService.ts`), station dedup now sorts by `stop_id` before picking one, and `App.tsx` uses `isSyncingRef` instead of state for the sync guard. A full test suite now exists at `src/services/__tests__/fgcService.test.ts` (19 tests, all passing) covering these paths with mocked `fetch`.

However, live-querying the real FGC API (`https://dadesobertes.fgc.cat/...`) surfaced a more serious, previously-undetected bug affecting the core "check train frequency for a station + hour" flow — see **FREQ-1** below. The BUG-4 fix (deterministic smallest-`stop_id` selection) papers over the *arbitrariness* of the original bug but not the underlying problem: some stations are legitimately split across multiple `stop_id`s that each carry different trains, and only one is ever queried.

**FREQ-1, FREQ-2, and FREQ-3 have since been fixed** (this same session, 2026-08-03):
- `fetchTrains` now filters by `stop_name` instead of `stop_id`, so all platforms at a station (e.g. all of `PE1`-`PE4` at Espanya) are included in one query. Verified live: Espanya at 08:00 now returns all 12 real departures across L8/S3/S4/S8/R5/R6, not 3.
- The dead `stop_sequence=1`/`originId` workaround was removed entirely — matching by name makes it unnecessary. `ROUTES[].originId` was dropped from `types.ts`; terminal detection is now `stationName === currentRoute.terminal`.
- `fetchStations`/`fetchTrains` now accept an optional `routeLongName`, used instead of `route_url like` for Lleida-La Pobla (whose records have `route_url: null`). Verified live: the route's station dropdown now populates with all ~20 real stations instead of showing "No stations found".
- `TRAIN_TYPES` was split per route (`ROUTES[].trainTypes`) with corrected values confirmed against live `route_short_name` groupings per network.
- Added ODSQL string escaping (`escapeODSQL`, backslash-escapes `'`) since station names can contain apostrophes (e.g. `L'Hospitalet Av. Carrilet`) — confirmed via the live API that Opendatasoft uses backslash-escaping, not SQL-style quote-doubling.
- End-to-end verified in a real browser (Playwright + system Chrome against the Vite dev server): Espanya/08:00 correctly shows 5 results on page 1 of 3 (12 total, multiple lines); Lleida-La Pobla station dropdown populates and returns real train data.

---

## Status Update (2026-08-27)

A test-first pass over the whole app. The suite now covers three layers:

| File | Env | Tests | What it covers |
|---|---|---|---|
| `src/services/__tests__/fgcService.test.ts` | jsdom | 36 | ODSQL query construction, escaping, paging, client-side filtering, error propagation |
| `src/components/__tests__/TrainCard.test.tsx` | jsdom | 6 | card rendering, colour fallback, last-train and accessibility badges |
| `src/components/__tests__/StationSelector.test.tsx` | jsdom | 8 | favorites ordering, loading/empty states, callbacks, prop immutability |
| `src/__tests__/App.test.tsx` | jsdom | 23 | end-to-end UI flows against a mocked service |
| `src/__tests__/routes.config.test.ts` | jsdom | 7 | `ROUTES` invariants (pins the terminal names) |
| `src/services/__tests__/fgcService.live.test.ts` | node | 16 | contract tests against the real API — opt-in via `npm run test:live` |

`npm test` → 80 passing, 16 skipped (the live suite). `npm run test:live` → 16 passing.

Testing infrastructure notes: `vitest.config.ts` now runs jsdom with the React plugin and
`src/test/setup.ts`. The resolved jsdom build exposes a `localStorage` stub with no methods,
so the setup file installs an in-memory `Storage`. The live suite is pinned to the `node`
environment because Node's `fetch` rejects an `AbortSignal` created by jsdom's
`AbortController` — a test-environment artifact only, not a runtime problem.

### TERM-1 (critical, fixed): Two of three networks returned no trains at all

**File**: `src/types.ts` (`ROUTES[].terminal`)

`terminal` is used verbatim in two ODSQL filters — `stop_name='<terminal>'` for terminal
detection and `trip_headsign='<terminal>'` for INBOUND — and two of the three configured
values did not exist in the dataset:

| Route | Configured | Actual in dataset | Rows matched |
|---|---|---|---|
| Llobregat-Anoia | `Barcelona - Plaça Espanya` | same | ok |
| Barcelona-Vallès | `Barcelona - Pl. Catalunya` | `Barcelona - Plaça Catalunya` | **0** |
| Lleida-La Pobla | `Lleida Pirineus` | `Lleida` | **0** |

INBOUND is the app's default direction, so selecting Barcelona-Vallès or Lleida-La Pobla
showed "No trains found" for *every* station on the network. Confirmed live:
`trip_headsign='Barcelona - Pl. Catalunya'` → 0 rows;
`trip_headsign='Barcelona - Plaça Catalunya'` → 247 rows at Sarrià alone. The
`isTerminal` UI constraints (forced OUTBOUND, disabled toggle) were likewise dead on
those networks — the remaining half of FREQ-2, which the earlier `originId` removal
had only partly addressed.

Guarded by `routes.config.test.ts` (pins the strings) and by the live suite, which
asserts each `terminal` exists as both a `stop_name` and a `trip_headsign`.

### BUG-3 (fixed): silent truncation at 100 results

The API caps `limit` at 100 (`limit=200` → `InvalidRESTParameterError`). Since the
FREQ-1 fix widened queries from one `stop_id` to a whole `stop_name`, a two-hour window
at a hub aggregates every platform — the busiest observed is 67 rows, close enough to
the cap to matter, and results are ordered `arrival_time asc`, so an overflow would drop
the *latest* trains and report a wrong `totalCount`. `fetchTrains` now walks `offset`
until the full result set is retrieved (`MAX_ROWS` = 500 safety stop, with a warning).

### BUG-7 (fixed): app crashed on corrupt `fgc_favorites`

`JSON.parse(localStorage.getItem('fgc_favorites'))` ran unguarded in a `useState`
initializer. A truncated or non-array value threw during the first render and took the
whole app down with a blank screen (a non-array value survived to `favorites.includes`
and crashed there instead). Now parsed defensively, keeping only string entries. This
also closes SEC-4's validation gap.

### BUG-8 (fixed): infinite spinner when the station list fails

`fetchStations` swallows its own errors and resolves to `[]`. `loadTrains` then returned
early *before* clearing `loading`, so the UI sat on "Fetching latest schedules…" forever
with no error and no way to retry. The empty case is now surfaced as
"Could not load the station list for this route." with a Try-again that re-runs the
station fetch.

### BUG-9 (fixed): stale responses overwrote fresh data

`loadTrains` had no request-ordering guard. Changing station or filter while a request
was in flight meant whichever response landed last won — the old station's trains could
replace the new station's. A monotonic request id now discards superseded responses,
including their `loading`/`error` transitions.

### BUG-10 (fixed): user stranded on a page that no longer exists

In live mode `totalCount` shrinks as trains depart. A user on page 3 of 3 could end up
with `offset` past the end: empty list, and the pagination controls hidden because
`totalPages > 1` was false — no way back. `loadTrains` now resets to page 1 when the
requested page is past the end.

### BUG-11 (fixed): default station silently ignored

`STATIONS[0].id` is `'ML2'`, but `fetchStations` dedupes Molí Nou's platforms to `ML1`,
so the id never matched and the app fell through to `fetchedStations[0]` — Abrera. Route
switches had the same problem, since stop_ids differ per network. The sync now prefers a
station with the same *name* before falling back to the first entry.

### BUG-6 (fixed): dead midnight-wrap branch

The hour-23 filter called `end.setHours(24, 0, 0, 0)` — which already rolls to next-day
midnight — and then added another day on top, leaving `end` two days out. Harmless in
effect (all rows are same-day) but misleading; the redundant branch is gone.

### SEC-1 (corrected and fixed)

The earlier claim that the key ships in the bundle is not accurate as written: Vite's
`define` only substitutes *referenced* identifiers, and nothing in `src/` reads
`process.env.GEMINI_API_KEY`, so a build of the current tree contains no key (verified by
grepping `dist/` for the value in `.env`). It was still a live hazard — a single future
reference would have inlined a real secret — so the `define` entry is removed.
`APP_DEBUG` stays, as `fgcService` reads it. `@google/genai`, `express` and `dotenv`
remain unused dependencies (INC-3); SEC-2/INFRA-1 (`COPY .env` in the Dockerfile) are
unchanged and still worth addressing.

### Known limitation, not fixed: timezone

All "now" logic uses `new Date()` in the *viewer's* local timezone, while the FGC
timetable is Europe/Madrid. A user outside that timezone gets the wrong current hour in
live mode. Fixing it means formatting "now" with `timeZone: 'Europe/Madrid'`; flagged
rather than changed, since it alters behaviour for every user.

---

## Critical Security Issues

### SEC-1: GEMINI_API_KEY Baked into Client Bundle

**File**: `vite.config.ts:12`

```ts
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
},
```

Vite's `define` replaces the string at build time with the literal value from `.env`. If a `.env` file contains `GEMINI_API_KEY=<key>`, the key will appear in plaintext in the compiled JS bundle, publicly accessible to anyone who downloads the site.

The `@google/genai` package is listed in `package.json` dependencies but is not imported anywhere in the current source — it appears to be a residue from an AI Studio template. The `GEMINI_API_KEY` define should be removed from `vite.config.ts` and `@google/genai` removed from `package.json`.

**Impact**: API key exposure → unauthorized charges / quota abuse.

---

### SEC-2: `.env` Copied into Docker Image

**File**: `docker/Dockerfile:38`

```dockerfile
COPY .env .
```

If `.env` contains secrets (e.g. `GEMINI_API_KEY`), they are baked into the Docker image layer. Any image push to a public registry would expose them. Even if the image is private, the layer is readable by anyone with pull access.

**Impact**: Secret exposure in Docker image layers.

---

### SEC-3: Unsanitized Values Interpolated into API Query String

**File**: `src/services/fgcService.ts:33,44`

```ts
let where = stopId === originId ? 'stop_sequence=1' : `stop_id='${stopId}'`;
// ...
const types = routeShortNames.map(name => `'${name}'`).join(',');
where += ` and route_short_name in (${types})`;
```

`stopId` comes from the station dropdown (populated from the API), and `routeShortNames` from the train type filter buttons. Their values are not escaped before being embedded in the query string. If either were ever controlled by user-supplied input (e.g., a manually edited `fgc_favorites` in localStorage containing a crafted station ID), the query could be manipulated.

**Impact**: API query injection (Opendatasoft OPAL query language). Severity depends on what the API allows — at minimum, an attacker could read arbitrary data from the dataset.

---

### SEC-4: Unvalidated `localStorage` Data Fed into Queries

**File**: `src/App.tsx:27-29`

```ts
const saved = localStorage.getItem('fgc_favorites');
return saved ? JSON.parse(saved) : [];
```

The favorites array is parsed from localStorage with no schema validation. A crafted value in localStorage (e.g. via a browser extension or past XSS) could inject arbitrary station IDs, which are then interpolated into API queries (SEC-3).

**Mitigation**: validate that each element is a string matching an expected pattern (e.g. 2-4 uppercase alphanumeric characters) before use.

---

## Functional Bugs

### BUG-1: `fetchTrains` Swallows Errors — Error State Never Shown

**File**: `src/services/fgcService.ts:156-159`

```ts
} catch (error) {
  console.error('Error fetching FGC data:', error);
  return { results: [], totalCount: 0 };
}
```

`fetchTrains` never throws. `App.tsx:loadTrains` has a `try/catch` that sets `error` state, but it will never be reached for API failures. Users see "No trains found" instead of the error banner.

**Fix**: re-throw the error so `App.tsx`'s error handler can show the error UI.

---

### BUG-2: "Auto-refreshing" Indicator Shown When Auto-refresh Is Disabled

**File**: `src/App.tsx:334` vs `src/App.tsx:76`

Auto-refresh condition (stops refreshing when train types are selected):
```ts
if (!selectedHour && selectedTrainTypes.length === 0) {
  const interval = setInterval(() => loadTrains(currentPage), 60000);
```

"Auto-refreshing" label condition (only hides when hour is selected):
```ts
{!selectedHour && (
  <span>Auto-refreshing</span>
)}
```

When a train type filter is active but no hour is selected, the UI shows "Auto-refreshing" and the "Live" badge, but no interval is running.

**Fix**: change the condition on the "Auto-refreshing" indicator to `!selectedHour && selectedTrainTypes.length === 0`.

---

### BUG-3: Silent Truncation at 100 Results

**File**: `src/services/fgcService.ts:74`

The API is always called with `limit=100`. For busy stations/hours with more than 100 departures in a two-hour window, results are silently truncated. The `totalCount` returned to the UI will be wrong (max 100), so pagination will also be incorrect.

**Fix**: either increase the limit or implement server-side pagination properly using the API's `offset` parameter.

---

### BUG-4: Station Deduplication Picks Arbitrary `stop_id` (partially fixed — see FREQ-1)

**File**: `src/services/fgcService.ts:206-214`

The dedup now sorts by `stop_id` before picking one, so the choice is deterministic rather than dependent on API response order. That does **not** fix the underlying issue: some multi-`stop_id` stations have every platform carrying *different, non-overlapping trains* rather than duplicate rows for the same trains. Picking any single `stop_id` — however deterministically — still discards real departures. See **FREQ-1** for confirmed live-data impact.

---

### BUG-5: Race Condition Between Station Sync and Train Loading

**File**: `src/App.tsx:72, 115-151`

```ts
// Train loading effect
useEffect(() => {
  if (isSyncingStations) return;  // guard
  loadTrains(currentPage);
  ...
}, [loadTrains, currentPage, isSyncingStations]);

// Station loading effect
useEffect(() => {
  setIsSyncingStations(true);  // set guard
  ...
}, [selectedRouteUrl]);
```

Both effects share the same React render cycle. When `selectedRouteUrl` changes, React schedules both effects. The station effect sets `isSyncingStations(true)` during its execution, but this state change doesn't take effect until the next render. There is a window where the train-loading effect fires before `isSyncingStations` is `true`, causing a redundant/stale train fetch for the old station.

**Fix**: derive `isSyncingStations` from a ref instead of state, or combine both effects and use a `useReducer`.

---

### BUG-6: Midnight Next-Hour Wrap Shows Hour `00` Trains Potentially From Wrong Day

**File**: `src/services/fgcService.ts:67`

```ts
const nextHour = ((now.getHours() + 1) % 24).toString().padStart(2, '0');
where += ` and (arrival_time like '${currentHour}:%' or arrival_time like '${nextHour}:%')`;
```

At `23:xx`, `nextHour` becomes `00`. The `viajes-de-hoy` dataset is for today's service, so midnight (00:xx) trains for the next calendar day shouldn't appear, but any "00:xx" entries that are part of today's late-night service (extended service past midnight) would correctly be included. The client-side filter then compares against `bufferTime`, which can go negative near midnight — `new Date()` at `23:55` minus 5 minutes is `23:50`, which is fine, but there is no validation that `arrival_time` "00:xx" is treated as next-day.

**Impact**: Low — the `viajes-de-hoy` API limits data to the current service day, but the logic is fragile and undocumented.

---

## Live-Data Findings (confirmed against `dadesobertes.fgc.cat` on 2026-08-03)

Static code review missed these — they only show up when the actual API responses are inspected.

### FREQ-1: Multi-Platform Stations Lose Most of Their Trains

**Files**: `src/services/fgcService.ts` (`fetchStations` dedup, `fetchTrains` `where` construction)

Major stations are not a single `stop_id` in the FGC data — they're split across multiple platform IDs, each carrying different lines. Confirmed live for hour `08:00`–`08:59`:

| Station | `stop_id` queried by the app | Trains found | Real total (all platforms) |
|---|---|---|---|
| Barcelona - Plaça Espanya | `PE1` (smallest of `PE1`–`PE4`) | 3 (line L8 only) | 12 (L8, S3, S4, S8, R5, R6) |
| Barcelona - Plaça Catalunya | `PC1` (smallest of `PC1`–`PC4`) | 24 (S1, S2 only) | 76 across `PC1`/`PC2`/`PC4` (`PC3` empty) — misses L6 (Sarrià) and L7 (Tibidabo) entirely |

Because `fetchStations` deduplicates by `stop_name` down to one `stop_id`, and `fetchTrains` queries `stop_id='<that one id>'`, selecting either of these two hub stations and an hour shows roughly a quarter of the actual departures and omits entire lines. This is very likely the concrete symptom behind "frequency check by station + hour doesn't work" — these are the two most natural stations to test.

There is a dead workaround for this already in the code: when `stopId === originId`, `fetchTrains` queries `stop_sequence=1` instead of a specific `stop_id`, which would span all platforms. But it never fires — see FREQ-2 — and even if it did, it over-matches: confirmed live, `stop_sequence=1 and route_url like '*llobregat-anoia*'` (144 total results) also pulls in trips that start at "Martorell Central" / "Martorell Enllaç" (local shuttles unrelated to Espanya) because `stop_sequence=1` just means "first stop of *some* trip on this route," not "this specific station."

**Fix options to discuss**: query by `stop_name` instead of `stop_id` (simplest — matches how these stations are actually modeled), or have `fetchStations` return/track all platform IDs per station name and query `stop_id in (...)` with the full set.

---

### FREQ-2: `ROUTES[].originId` Doesn't Match Any Real `stop_id`

**File**: `src/types.ts:47-51`

```ts
export const ROUTES = [
  { name: 'Llobregat-Anoia', url: '...', terminal: 'Barcelona - Plaça Espanya', originId: 'ES' },
  { name: 'Barcelona-Vallès', url: '...', terminal: 'Barcelona - Pl. Catalunya', originId: 'PC' },
  { name: 'Lleida-La Pobla', url: '...', terminal: 'Lleida Pirineus', originId: 'LP' }
];
```

Confirmed live: `stop_id='ES'` returns `total_count: 0`. Real platform IDs for these terminals are `PE1`–`PE4` (Espanya) and `PC1`–`PC4` (Catalunya) — always a 2-letter code + numeric platform suffix, never the bare 2-letter code used here.

Effects, all confirmed by reading the current code with this in mind:
- `fetchTrains`'s `stopId === originId` check (`src/services/fgcService.ts:36`) is always `false` for real fetched stations, so the `stop_sequence=1` all-platforms workaround (see FREQ-1) never activates.
- `App.tsx`'s effect that forces `direction` to `OUTBOUND` at the terminal (`App.tsx:156-161`) and the "Only outbound trains available from this station" message / disabled toggle button (`App.tsx:145, 226, 240`) never trigger for the real, dynamically-fetched Espanya/Catalunya station — the UI lets you toggle to INBOUND there when the original design intended to prevent it.
- The static `STATIONS` fallback in `types.ts:28-40` uses the same bare-code convention (`'ES'`, `'MG'`, `'IL'`, etc.) and would be equally non-functional if ever used as a fallback (see INC-2) — with one coincidental exception: `'ML2'` (Molí Nou) happens to be a real platform ID, which is why the app *appears* to work on first load (that's the hardcoded default station) even though this bug exists.

---

### FREQ-3: Lleida-La Pobla Line Has `route_url = null` — `like` Filter Never Matches

**File**: `src/services/fgcService.ts:51-55, 172-180` (the `route_url like '*<slug>*'` clause)

The "Lleida-La Pobla" line is real and has live data in `viajes-de-hoy` — confirmed 264 records across ~20 stations (Lleida, La Pobla de Segur, Balaguer, Àger, etc.) under `route_long_name='Lleida - La Pobla'`. However, every one of those records has `route_url: null` (FGC's site apparently has no dedicated page for this line, unlike the others). Opendatasoft's `like` operator never matches `null`, so `route_url like '*lleida-la-pobla*'` always returns zero stations/trains for this network, even though the underlying data is there.

Unlike Llobregat-Anoia and Barcelona-Vallès — where several distinct `route_long_name` values (one per sub-line) share one `route_url` slug — Lleida-La Pobla has exactly one `route_long_name` for the whole network, so it can be matched directly.

**Fix**: for this route, filter on `route_long_name='Lleida - La Pobla'` instead of `route_url like`. Needs a way to tell the two matching strategies apart per route (e.g. an optional field on the `ROUTES` entry), since the other two networks still rely on the `route_url` slug to span their multiple `route_long_name` values.

---

### FREQ-4: `TRAIN_TYPES` Contains Non-Existent Route Short Names

**File**: `src/types.ts:53-55`

```ts
export const TRAIN_TYPES = [
  'L8', 'S3', 'S4', 'S8', 'S9', 'R5', 'R6', 'R50', 'R60'
];
```

Confirmed live via `group_by=route_short_name` — the real set of values across all three networks is: `FV, L6, L7, L8, L12, MM, R5, R53, R6, R63, RL1, RL2, S1, S2, S3, S4, S8`. `S9`, `R50`, and `R60` don't exist (the real short names are `S1`/`S2` and `R53`/`R63`), and `L6`, `L7`, `L12`, `FV`, `MM`, `RL1`, `RL2` are all missing from the filter list entirely. Selecting a non-existent type (`S9`, `R50`, `R60`) silently zeroes out results via `route_short_name in (...)`.

**Fix**: replace with the confirmed real values, split appropriately per route network (the current single flat list is shown regardless of which `ROUTES` entry is selected).

---

## Inconsistencies Between README and Code

### INC-1: README Claims Retry Mechanisms Exist

**README**: "Built-in timeout and retry mechanisms for API calls"

**Code**: Only a 10-second abort timeout exists (`fetchWithTimeout`). There is no retry logic anywhere in `fgcService.ts`.

---

### INC-2: `STATIONS` Hardcoded for Llobregat-Anoia Only

**File**: `src/types.ts:28-40`

The initial `STATIONS` constant contains 11 stations, all from the Llobregat-Anoia network. On first load, the app immediately fetches stations dynamically for the selected route, so this is only a brief flash, but if the station API call fails, the UI falls back to `stations = []` (empty list), not to the static fallback. The static `STATIONS` constant becomes unreachable after initialization.

**Fix**: either remove `STATIONS` and show a loading state on first load, or use it as a proper fallback when the API fails.

---

### INC-3: Ghost Dependencies in `package.json`

The following packages are installed but not used anywhere in the source:

| Package           | Listed in       | Used in source |
|-------------------|-----------------|----------------|
| `@google/genai`   | `dependencies`  | No             |
| `express`         | `dependencies`  | No             |
| `dotenv`          | `dependencies`  | No             |

These are residues from an AI Studio project template. They increase bundle size and attack surface.

---

### INC-4: `package.json` `name` Field Is `react-example`

**File**: `package.json:2`

The project name is `react-example`, which is the AI Studio template default. It should match the actual project.

---

### INC-5: `vite` Listed in Both `dependencies` and `devDependencies`

**File**: `package.json`

`vite` appears in both sections. It should only be in `devDependencies`.

---

### INC-6: `Makefile` Line 1 Missing `!`

**File**: `Makefile:1`

```makefile
#bin/bash
```

This appears to be an attempt at a shebang (`#!/bin/bash`) that is missing the `!`. In a Makefile it is treated as a comment and is harmless, but it is confusing and inconsistent.

---

## Infrastructure Issues

### INFRA-1: `make dist` Fails in CI Without `.env`

**File**: `docker/Dockerfile:38`

```dockerfile
COPY .env .
```

The build stage unconditionally copies `.env`. In the GitHub Actions workflow (`deploy.yml`), no `.env` file is created before the build. `COPY` on a missing file causes a build failure.

The GitHub Actions workflow does **not** use Docker at all — it runs `npm install && npm run build` directly — so the `make dist` target is only used locally. However, any local user without a `.env` file will also hit this failure.

**Fix**: use `COPY .env* .` (copies if exists, skips if not), or use `ARG`/`ENV` to pass the key at build time.

---

### INFRA-2: `make dist` Only Removes `dist/assets`, Leaving Stale Root Files

**File**: `Makefile:34`

```makefile
dist:
	rm -rf dist/assets
	docker build ...
	docker cp $(APP_NAME)_build:/app/dist/. ./dist
	docker rm $(APP_NAME)_build
```

Only `dist/assets/` is deleted before extraction. Any stale `index.html` or other root-level files from a previous build will persist and be overwritten only if the new build produces the same files. A safer approach is `rm -rf dist/` before the Docker build.

---

### INFRA-3: GitHub Actions `permissions: contents: write` Is Overly Broad

**File**: `.github/workflows/deploy.yml:8-9`

```yaml
permissions:
  contents: write
```

`contents: write` grants write access to the entire repository. For a GitHub Pages deployment only the `gh-pages` branch needs to be written. This should be scoped to `pages: write` + `id-token: write` using the modern GitHub Pages deployment API, or the permission should be documented as intentional.

---

### INFRA-4: `make dist` Container Name Collision

**File**: `Makefile:36-38`

```makefile
docker create --name $(APP_NAME)_build $(APP_NAME):build
docker cp $(APP_NAME)_build:/app/dist/. ./dist
docker rm $(APP_NAME)_build
```

If a previous `make dist` run was interrupted, the container `train_search_build` may still exist. The subsequent `docker create` will fail with a "name already in use" error, and the `docker rm` cleanup step will not run.

**Fix**: add `docker rm -f $(APP_NAME)_build 2>/dev/null || true` before the `docker create` step.
