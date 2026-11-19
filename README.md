# FGC Trains

An unofficial, mobile-first web app for **Ferrocarrils de la Generalitat de Catalunya (FGC)** trains: live departures, direct journeys between two stations, and real-time train positions, built on FGC Open Data. It runs entirely in the browser, with no backend.

## Features

- **One search for the whole network**: no picking a network first. Search ignores accents and handles abbreviations (`placa cat`, `sarria`, `pl molina` and the code `PE` all work).
- **Live departures board**: countdowns, platform, and a "last train" flag. Late trains the live feed says are still coming stay on the board. Filter by line.
- **From → to journeys**: every direct train between two stations, with departure, arrival and ride time. Swap direction in one tap.
- **Live train info**: from FGC's train-positioning feed, how many stops away the train is (or "at platform"), on time or delayed, and how full it is.
- **Nearby stations**: the three closest stations, using browser geolocation.
- **Favourites and recents**: save stations and journeys (origin + destination) for one-tap access. Stored in a first-party cookie.
- **Plan ahead**: pick a departure time instead of "now".
- **Shareable links**: `?from=PC&to=SR&at=08:30`. The Back button works.
- **Catalan, Spanish and English**: detected from the browser, switchable, remembered.
- **Correct time everywhere**: all times use Europe/Madrid, including after-midnight trains (`24:30`), whatever the viewer's timezone.
- Light/dark theme, keyboard-accessible combobox, works on phones and desktops.

## Tech stack

React 19, TypeScript (strict), Vite 6, Tailwind CSS 4, Lucide icons, Vitest + Testing Library.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit + UI tests (mocked API)
npm run test:live    # contract tests against the real FGC API
npm run build        # type-check + production build in dist/
```

Docker: `make up` (dev server on :3000), `make test`, `make dist`.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: `npm ci`, `npm test`, `npm run build`, then publishes `dist/` to the `gh-pages` branch. `npm run deploy` does the same by hand.

## Documentation

- [`docs/architecture.md`](docs/architecture.md): modules, data flow, state.
- [`docs/api-integration.md`](docs/api-integration.md): which FGC datasets are used, how, and the verified quirks.
- [`docs/findings.md`](docs/findings.md): bug and security history of the v1 app.

---

*Data: [FGC Open Data](https://dadesobertes.fgc.cat/). This is an unofficial application, not affiliated with FGC.*
