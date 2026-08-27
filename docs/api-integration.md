# FGC API Integration

## Data Source

**Endpoint**: `https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets/viajes-de-hoy/records`

This is the Opendatasoft v2.1 API for the FGC "viajes-de-hoy" (today's trips) dataset. It returns GTFS-derived real-time schedule data for the current service day.

## `fetchStations(routeUrl, routeLongName?)`

Fetches the list of stations for a given route network.

**Query parameters**:
```
group_by=stop_id, stop_name
select=stop_id, stop_name
where=<route match clause, see below>
limit=100
```

**Returns**: `{ id: string; name: string }[]`

**Post-processing**:
- Deduplicates by `stop_name`, sorting by `stop_id` first so the pick is deterministic. This `id` is used only as a stable UI key (dropdown `value`, favorites, React `key`) — it is **not** used to query trains (see FREQ-1 below), so which platform ID gets picked no longer affects correctness.
- Sorts alphabetically by name

**Timeout**: 10 seconds (via `fetchWithTimeout`)

---

## Route matching: `route_url like` vs `route_long_name=`

Both `fetchStations` and `fetchTrains` scope results to one route network via a shared `routeWhereClause(routeUrl, routeLongName)` helper:

- If `routeLongName` is provided (only `ROUTES` entries that set it — currently just Lleida-La Pobla): `route_long_name='<value>'`.
- Otherwise: `route_url like '*<slug>*'`, where `<slug>` is the last path segment of `routeUrl` with `.asp` removed (e.g. `llobregat-anoia`).

**Why two strategies**: Llobregat-Anoia and Barcelona-Vallès each span several lines (several distinct `route_long_name` values, e.g. "Barcelona Pl. Espanya - Manresa") that share one `route_url` slug — so `like` on the slug is how those get grouped. Lleida-La Pobla's records have `route_url: null` in the live dataset (confirmed — FGC's site has no dedicated page for it), so `like` can never match it; it's matched by its single `route_long_name` value instead. `ROUTES[].routeLongName` in `types.ts` carries this per-route.

---

## `fetchTrains(stationName, direction, limit, offset, selectedHour?, routeShortNames?, routeUrl?, terminalName, routeLongName?)`

Fetches train schedules for a given station, direction, and optional filters.

Filters by `stop_name`, not `stop_id`. Hub stations (Barcelona - Plaça Espanya, Barcelona - Pl. Catalunya) are split across several `stop_id`s — one per platform — each carrying different trains; a `stop_id`-based query only ever saw one platform's worth. Matching by name captures all platforms in a single query. Confirmed live: Espanya at a given hour returns all real departures across every line, not just one.

All string values interpolated into the `where` clause (`stationName`, `terminalName`, train type names, the route slug/long name) are passed through `escapeODSQL`, which backslash-escapes embedded single quotes — confirmed against the live API that this is Opendatasoft's escaping convention (not SQL-style quote-doubling). This matters once station names are used directly, since some contain apostrophes (e.g. `L'Hospitalet Av. Carrilet`).

### Where clause construction

| Condition                          | Applied when                                        |
|------------------------------------|------------------------------------------------------|
| `stop_name='<stationName>'`        | Always                                                |
| `trip_headsign!='<terminal>'`      | Station is the terminal (`stationName === terminalName`) — only one direction is meaningful there |
| `trip_headsign='<terminal>'`       | INBOUND direction at a non-terminal station           |
| `trip_headsign!='<terminal>'`      | OUTBOUND direction at a non-terminal station          |
| `route_short_name in (...)`        | Train type filter active                              |
| `route_url like '*<slug>*'` or `route_long_name='<name>'` | Route network filter (see matching section above) |
| `arrival_time like 'HH:%'`         | Hour filter active                                    |
| `arrival_time like 'HH:%' or '...'`| Default (live) mode: current + next hour               |

There is no longer a `stop_sequence=1` special case (previously used — and never actually reachable — for the terminal station; matching by name replaces it, since a name-based query naturally spans every platform whether or not the station is the terminal).

### Two-request pattern

Every call to `fetchTrains` makes **two** HTTP requests:

1. **Main request**: fetches up to 100 results for the selected time window.
2. **Last-train request**: fetches the single latest train of the day (using `baseWhere` without the time filter, ordered `arrival_time desc limit 1`). This is used to flag the last train of the day in the UI.

The last-train request failure is swallowed silently (no UI error shown).

### Client-side pagination

The API is called with `limit=100, offset=0` always. Pagination is applied client-side by slicing `filteredResults`:

```ts
const paginatedResults = filteredResults.slice(offset, offset + limit);
```

where `limit` is `ITEMS_PER_PAGE = 5` from `App.tsx`.

### Time filtering

- **Live mode**: a 5-minute buffer is applied (`bufferTime = now - 5min`). Results are filtered to `arrival_time >= bufferTime`.
- **Hour mode**: results are filtered to `[hour:00, hour+1:00)`.

### Last-train marking

A journey is marked `is_last_train = true` if its `arrival_time`, `trip_headsign`, and `route_short_name` all match the last-train query result.

### Returns

```ts
{ results: FGCJourney[]; totalCount: number }
```

`totalCount` reflects the number of client-side filtered results (before pagination), not the API's `total_count`.

---

## FGCJourney shape

```ts
interface FGCJourney {
  stop_id: string;
  stop_name: string;
  arrival_time: string;       // "HH:MM:SS"
  departure_time: string;     // "HH:MM:SS"
  trip_headsign: string;      // Destination display name
  route_short_name: string;   // e.g. "L8", "R5"
  route_color: string;        // Hex without '#', e.g. "FF6319"
  date: string;
  stop_lat: number;
  stop_lon: number;
  wheelchair_accessible?: number;  // 1 = accessible
  route_url?: string;
  stop_sequence?: number;
  is_last_train?: boolean;    // Added client-side
}
```

---

## Timeout & Error Handling

- All requests use `fetchWithTimeout` with a 10-second abort timeout.
- `fetchStations` catches errors and returns `[]` (the caller in `App.tsx` clears the station list).
- `fetchTrains` re-throws on non-OK responses and network errors, so `App.tsx`'s `loadTrains` catch block can set the error state and show the error UI. The last-train-of-day lookup (a second, secondary request) is the one exception — its failures are swallowed silently, since it only adds an informational badge and shouldn't block the main result.
