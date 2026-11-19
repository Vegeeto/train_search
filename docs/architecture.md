# Architecture

## Shape

A static single-page app (React + TypeScript + Vite) that talks to the FGC Open Data API directly from the browser. Every dataset it uses sends `Access-Control-Allow-Origin: *`, so there is no backend and no secrets.

```
src/
├── main.tsx                 entry
├── App.tsx                  shell: header, search card, home vs results
├── index.css                Tailwind + light/dark theme tokens
├── lib/                     framework-free logic (all unit-tested)
│   ├── api.ts               fetch with timeout + retry, ODSQL escaping, export URLs
│   ├── stations.ts          network-wide station list (one grouped export)
│   ├── timetable.ts         per-station full-day timetable, cached
│   ├── departures.ts        departures board from timetable rows
│   ├── journeys.ts          A → B direct-train pairing (no trip_id in the data)
│   ├── live.ts              live positioning feed: parse + match to departures
│   ├── search.ts            accent/abbreviation-insensitive station search
│   ├── geo.ts               nearest stations
│   ├── storage.ts           cookie-backed preferences (validated on read)
│   ├── time.ts              Europe/Madrid clock, GTFS `24:xx` times
│   ├── colors.ts            line colours + readable text colour
│   └── types.ts
├── hooks/
│   ├── useAsync.ts          keyed loading with abort (stale responses can't win)
│   ├── useNow.ts            Madrid clock tick (15 s)
│   ├── useLiveTrains.ts     30 s polling, paused while the tab is hidden
│   ├── usePrefs.ts          favourites / recents / language
│   └── useUrlState.ts       ?from=&to=&at= ↔ state, Back button support
├── i18n/                    ca / es / en messages + translator context
└── components/
    ├── StationPicker.tsx    ARIA combobox
    ├── TrainResults.tsx     loads data, attaches live info, picks the panel
    ├── ResultsPanel.tsx     list with line filter + "show more"
    ├── TrainRows.tsx        departure row / journey row
    ├── LiveInfo.tsx         stops-away, punctuality, occupancy meter
    ├── HomePanel.tsx        favourites, nearby, recents
    └── LineBadge.tsx
```

## Data flow

```
App start ──► fetchStations()             1 grouped export, ~600 rows, ~0.3 s
               └► Station[] (code, name, coords, lines)

URL / picker ─► selection {from, to, at}   (mirrored in the URL)

TrainResults
  ├─ timetable.get([from.name, to?.name])   full day per station, cached 30 min;
  │                                         adding a destination only downloads it
  ├─ departuresFrom(rows)   or   directJourneys(rows, from, to)
  ├─ filter by start time (now or `at`)
  └─ live mode only:
       useLiveTrains() every 30 s ──► attachLive(items, from.code, trains)
```

The timetable is downloaded once per station and filtered in memory, so changing the time, the line filter or paging costs no request. Only the live feed is polled.

## State

There is no global store. The selection lives in the URL (`useUrlState`), preferences in a cookie (`usePrefs`), and server data in `useAsync` and the `TimetableCache` singleton. `useAsync` aborts superseded loads and ignores their results, which prevents the "old station's response overwrites the new one" class of bug.

## Preferences cookie

`fgc_prefs`, scoped to the app's own path, `SameSite=Lax`, `Secure` on HTTPS, max-age 400 days. It holds station codes only:

```json
{"stations":["PC"],"journeys":[["SC","SR"]],"recents":[["PC",null]],"lang":"ca"}
```

`sanitizePrefs` validates every value against `^[A-Z0-9]{1,4}$` on read, so a corrupt or tampered cookie resets to defaults instead of crashing or reaching a query. Size is capped below the 4 KB cookie limit by dropping recents first.

## Testing

| Suite | What |
|---|---|
| `src/lib/__tests__/*.test.ts` | pure logic: time, search, journeys, live matching, storage, API client, caching, i18n parity |
| `src/__tests__/App.test.tsx` | UI flows against a mocked `fetch`: search → departures with live badge, A → B + favourite cookie, shared link + language switch, retry, bad link |
| `src/lib/__tests__/live-api.test.ts` | opt-in (`npm run test:live`) contract tests against the real API, including plausible ride-time ranges for real station pairs |
