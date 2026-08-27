# Architecture Overview

## Application Type

Single-page application (SPA) built with React 18 + TypeScript + Vite. There is no backend — all data is fetched directly from the FGC Open Data API from the browser.

## Directory Structure

```
train_search/
├── src/
│   ├── App.tsx               # Root component: state management, routing logic, layout
│   ├── types.ts              # TypeScript interfaces + static constants (STATIONS, ROUTES, DIRECTIONS); train types live per-route on ROUTES[].trainTypes
│   ├── services/
│   │   └── fgcService.ts     # All FGC API calls (fetchTrains, fetchStations)
│   └── components/
│       ├── TrainCard.tsx     # Renders a single train journey card
│       └── StationSelector.tsx # Station dropdown with favorites sorting
├── docker/
│   ├── Dockerfile            # Multi-stage: `development` and `build` targets
│   └── docker-compose.yml    # Dev environment: mounts source, maps port 3000
├── .github/workflows/
│   └── deploy.yml            # CI: npm build → gh-pages branch on push to main
├── Makefile                  # Docker Compose shortcuts + `dist` extraction target
├── vite.config.ts            # Vite config: React plugin, Tailwind, base='./', GEMINI_API_KEY define
└── package.json              # Scripts: dev, build, deploy (gh-pages), lint
```

## State Management (App.tsx)

All state lives in the root `App` component via `useState`. There is no external state library.

| State variable       | Type            | Purpose                                               |
|----------------------|-----------------|-------------------------------------------------------|
| `stations`           | `Station[]`     | Stations for the currently selected route (dynamic)   |
| `selectedStationId`  | `string`        | Currently selected station ID (UI key only — the matching `Station.name` is derived and passed to `fetchTrains`, not the ID) |
| `direction`          | `string`        | `INBOUND` or `OUTBOUND`                               |
| `selectedRouteUrl`   | `string`        | URL identifier for the selected FGC route network     |
| `selectedHour`       | `string`        | Hour filter (`''` = live mode, `'0'`–`'23'` = fixed) |
| `selectedTrainTypes` | `string[]`      | Active train type filters (e.g. `['L8', 'R5']`)       |
| `currentPage`        | `number`        | Current page index (0-based, client-side pagination)  |
| `trains`             | `FGCJourney[]`  | Current page of train results                         |
| `totalCount`         | `number`        | Total filtered results (for pagination math)          |
| `loading`            | `boolean`       | True while any fetch is in-flight                     |
| `isSyncingStations`  | `boolean`       | True while station list is being fetched              |
| `error`              | `string\|null`  | Error message for the results section                 |
| `lastUpdated`        | `Date`          | Timestamp of the last successful fetch                |
| `favorites`          | `string[]`      | Favorite station IDs, persisted to `localStorage`     |

## Data Flow

```
User selects route
      │
      ▼
useEffect [selectedRouteUrl]
      │  fetchStations(routeUrl, routeLongName)  ──→  FGC API (group_by stop_id, stop_name)
      │  setStations(results)
      │  (auto-selects first station if current is not in new list)
      ▼
useEffect [loadTrains, currentPage, isSyncingStations]
      │  fetchTrains(stationName, direction, limit, offset, hour, types, routeUrl, terminal, routeLongName)
      │  ──→  FGC API (viajes-de-hoy/records with where clause)
      │  ──→  FGC API (second request for last-train-of-day detection)
      │  client-side filter by time + paginate
      ▼
      trains / totalCount state updated → TrainCard components render
```

## Auto-Refresh

A 60-second `setInterval` is set up inside the train-loading `useEffect`, **only when** `!selectedHour && selectedTrainTypes.length === 0`. The interval is cleared when those conditions change or when the component unmounts.

## Favorites Persistence

Favorites are stored in `localStorage` under the key `fgc_favorites` as a JSON-serialised `string[]` of station IDs. They are read on initial render and written on every change via a dedicated `useEffect`.

## Routing & Networks

Three route networks are defined as static constants in `types.ts`:

| Name              | URL slug              | Terminal station          | `routeLongName` override |
|-------------------|-----------------------|---------------------------|---------------------------|
| Llobregat-Anoia   | `llobregat-anoia`     | Barcelona - Plaça Espanya | —                          |
| Barcelona-Vallès  | `barcelona-valles`    | Barcelona - Pl. Catalunya | —                          |
| Lleida-La Pobla   | `lleida-la-pobla`     | Lleida Pirineus           | `Lleida - La Pobla` (its records have `route_url: null`, see `docs/api-integration.md`) |

Each route also carries `trainTypes: string[]` — the valid `route_short_name` filter values for that network, confirmed against the live API and shown in the Train Types filter section.

"Terminal" is identified by **name**, not a separate ID: `App.tsx` derives `isTerminal = selectedStationName === currentRoute.terminal`. When the selected station is the terminal, only outbound trains are shown (direction toggle is disabled) — this used to rely on a hardcoded `originId` field that didn't match any real `stop_id` in the live data (dead code); it was removed once station matching switched to `stop_name`.

## Deployment

Two parallel deployment paths exist:

1. **GitHub Actions** (`.github/workflows/deploy.yml`): runs `npm install && npm run build` on push to `main`, then uses `JamesIves/github-pages-deploy-action@v4` to push `dist/` to the `gh-pages` branch.

2. **Manual** (`npm run deploy`): uses the `gh-pages` npm package to push `dist/` to `gh-pages`. Requires the project to have been built first (`predeploy` script runs `npm run build` automatically).

3. **Docker** (`make dist`): builds the `build` stage of the Dockerfile, creates a temporary container, copies out `dist/`, and removes the container. Used to produce deployment artifacts locally via Docker.
