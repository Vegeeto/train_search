# FGC API integration

Base: `https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets` (Opendatasoft v2.1). All facts below were verified against the live API on 2026-11-19. The opt-in contract suite (`npm run test:live`) re-checks the important ones.

## Datasets used

| Dataset | Used for | Endpoint |
|---|---|---|
| `viajes-de-hoy` | stations, today's timetable | `/exports/json` |
| `posicionament-dels-trens` | live position, punctuality, occupancy | `/exports/json` |

**Why `exports` rather than `records`**: `records` caps `limit` at 100 (`limit=200` → `InvalidRESTParameterError`), while `exports` returns every matching row in one gzip'd response. A whole day at Plaça Catalunya is 924 rows, about 13 KB on the wire.

All requests go through `fetchJson`: 15 s timeout (10 s for the live feed), one retry with backoff on network errors, timeouts, 429 and 5xx, and none when the caller aborts.

## Stations: one request for the whole network

```
group_by = stop_name,parent_station,stop_id,route_short_name,route_color
select   = …, avg(stop_lat) as lat, avg(stop_lon) as lon, max(wheelchair_boarding) as wb
```

The result is reduced client-side to one `Station` per `stop_name`, with every platform merged. That fixes the v1 hub-station bug (FREQ-1) by construction.

- **Station code**: `parent_station` (`PC`, `SR`, …). The one exception is Terrassa Nacions Unides, whose `parent_station` is null; its code is derived from `stop_id` minus the platform digits (`NA1` → `NA`). These codes are the ones the live feed uses.
- **Line colours**: some `route_color`s are light but come with a white `route_text_color` (R6 `b3b3b3`, L12 `b2aed3`), so text colour is computed from contrast instead.

## Timetable

```
where  = stop_name='<A>'                 or  stop_name in ('<A>','<B>')
select = date,stop_name,stop_id,route_short_name,route_color,trip_headsign,
         arrival_time,departure_time,stop_sequence,shape_id,platform_code
```

Strings are escaped with `escapeODSQL`. Opendatasoft uses backslash escaping (`L\'Hospitalet`), not SQL quote doubling.

Quirks the code relies on:

- **Times go past midnight**: `24:54:00` belongs to the current service day. All logic uses "seconds after service-day midnight" in Europe/Madrid. If the dataset's `date` is yesterday in Madrid, "now" is shifted by +24 h (`serviceSeconds`).
- **No time comparisons server-side**: `departure_time >= '13:00:00'` fails with `IncompatibleTypesInComparisonFilter`, and `max()` on text fails too. That's why the whole day is fetched and filtered client-side.
- **Headsigns equal station names exactly.** A row where `trip_headsign == stop_name` is a train terminating there, so it is excluded from departures.

## Direct journeys without `trip_id`

`viajes-de-hoy` has no trip identifier, so the two ends of a ride must be paired (`lib/journeys.ts`).

**Pairing by time alone is wrong.** On S1/S2, with a train every ~6 min and a 12-min ride, "the first arrival at B after leaving A" is the *previous* train's. A first implementation did exactly this and produced 1–6-minute rides from Plaça Catalunya to Sarrià.

**What works:**
1. Group rows by `(route_short_name, shape_id, trip_headsign)`: one stopping pattern in one direction, with no overtaking.
2. Within a group, split each end by `stop_sequence`. Trains from the same origin share it, so this yields matching cohorts of trains, e.g. 119 departures ↔ 119 arrivals.
3. Keep only pairs where the destination's sequence is greater, which drops the opposite direction.
4. Find the order alignment with the most pairs at a near-constant ride time. That's the typical ride. A regular timetable makes offsets of one headway look consistent too, but those have fewer pairs.
5. Pair trains in order, each departure taking the arrival closest to the typical ride (tolerance `max(2 min, 12%)`).

Verified on real data: Plaça Catalunya → Sarrià 12 min (329 trains), Sant Cugat → Catalunya 29, Catalunya → Sabadell Parc del Nord 54, Espanya → Manresa-Baixador 87 (R5) / 82 (R50), Lleida → La Pobla 93–106.

Journeys needing a change of train (e.g. Sarrià → Manresa) are reported as "no direct trains". Transfers are out of scope for now.

## Live positioning feed

`posicionament-dels-trens`: about 60 rows, one per running train, refreshed by FGC every few seconds and polled by the app every 30 s.

| Field | Meaning |
|---|---|
| `lin` | line, **not** always the timetable's `route_short_name` (live `R61`/`R62` run as timetable `R6`/`R60`; `M1`/`M2` vs `MM`) |
| `desti`, `origen`, `estacionat_a` | station codes, the same as `parent_station` |
| `properes_parades` | upcoming stops as `{"parada": "GR"};{"parada": "PC"}`. Excludes the current station |
| `en_hora` | `"True"` / `"False"`, whether the train runs within schedule |
| `ocupacio_<car>_percent` / `_tram` | per-car occupancy %, level 1 low / 2 medium / 3 high |

**Matching a live train to a scheduled departure** at station S (`attachLive`):
- The train must be heading through S, i.e. stopped at S or with S in `properes_parades`, and must not terminate at S.
- Its `desti` must equal the departure headsign's station code. A same line family (`R61` ~ `R6`) is preferred, with destination-only as the fallback.
- The nearest train claims the earliest free departure, within time bounds that are plausible for its stops away.
- A late train (`en_hora=False`) may claim a slot up to 20 min past its scheduled time. Those stay on the board as "Delayed".

Trains that start at a terminus (e.g. departures from Plaça Catalunya) appear in the feed only once they're at the platform, so later departures there show the timetable only.

The feed has no delay in minutes. Exact delays would need GTFS-Realtime `trip-updates` (protobuf) joined through the GTFS `trips`/`stop_times` data, because `viajes-de-hoy` has no `trip_id`. That's a possible future step.

## Other datasets worth knowing

| Dataset | Notes |
|---|---|
| `trip-updates-gtfs_realtime`, `alerts-gtfs_realtime`, `vehicle-positions-gtfs_realtime` | protobuf `.pb` files behind the dataset's file URL. Open to browser requests. Needs a decoder library |
| `gtfs_stops`, `trips`, `gtfs_routes`, `gtfs_shapes`, `calendar_dates`, `gtfs_zip` | static GTFS |
| `avisos` | service notices (empty when checked) |
| `accesibilidad-itinerarios` | accessibility routes |
