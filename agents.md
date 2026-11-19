# Notes for agents working on this repo

- **Read first:** `docs/architecture.md` (module map) and `docs/api-integration.md` (verified API quirks). The API quirks are the non-obvious part. Don't "simplify" code that works around one without re-checking it live.
- **Logic lives in `src/lib/`** as pure functions, covered by unit tests. Components stay thin.
- **Never pair journey ends by "next arrival after departure".** It's wrong whenever the ride is longer than the headway. See `lib/journeys.ts`.
- **Times are service-day seconds in Europe/Madrid** (`lib/time.ts`). Never use `new Date().getHours()`.
- **Station identity is the code** (`parent_station`, e.g. `PC`). It's used in URLs, cookies and live matching. Timetable queries filter by `stop_name`, to cover every platform.
- **Interpolate strings into ODSQL only via `quote()` / `escapeODSQL()`.**
- **Every UI string goes in `src/i18n/messages.ts`, in all three languages.** A test enforces key and placeholder parity.
- **Checks:**
  - `npm test` (mocked) and `npm run lint` (tsc) must pass.
  - `npm run test:live` hits the real API. Run it after touching `lib/journeys.ts`, `lib/live.ts` or any query.
