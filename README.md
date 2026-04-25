# Oasis

Oasis is a mobile-first progressive web application for locating nearby water fountains, drinking water taps, and natural springs while moving outdoors. It is designed for runners, cyclists, hikers, walkers, and urban travelers who need fast hydration decisions without navigating a generic map workflow.

The application combines live device geolocation, open geospatial data from OpenStreetMap via Overpass API, and an offline-oriented map experience. The result is a focused field utility that answers one question with minimal friction: where is the nearest usable water source from my current or selected position?

## Project Overview

### What the app does

Oasis continuously tracks the user's location, queries nearby drinking water features, ranks them by distance, and presents the result through two synchronized interfaces:

- An interactive map with proximity context, nearest-source guidance, and direct navigation actions.
- A sortable proximity list optimized for quick scanning and one-tap route launch.

The app is optimized for on-the-go use on phones, including high-accuracy GPS tracking, a compass mode, haptic feedback, persistent screen wake lock, and progressive offline behavior.

### Who it is for

- Runners who need hydration points without breaking pace.
- Cyclists and bikepackers who need fast visual confirmation of refill options.
- Hikers and trail users who need natural springs and drinking water points.
- Travelers exploring unfamiliar cities where public fountains are not obvious.

### Problem it solves

Generic map apps can show water points, but they usually require manual search, are cluttered with unrelated places, and behave poorly when signal is weak. Oasis reduces that interaction cost by:

- fetching only water-related features,
- computing distance and nearest-target status automatically,
- exposing fast navigation and share actions,
- preserving previously fetched data and prewarming map tiles for offline use.

## Data Sources

### Primary source

The app uses public OpenStreetMap data through multiple Overpass API mirrors. It queries point features around the target coordinate for:

- `amenity=drinking_water`
- `amenity=fountain` with `drinking_water=yes`
- `man_made=water_tap` with `drinking_water=yes`

### Data formats involved

- JSON responses returned by Overpass API.
- Browser geolocation coordinates from the W3C Geolocation API.
- Device orientation events from the browser sensor APIs.
- Local browser storage via `localStorage` and Cache Storage.
- PWA manifest metadata and static icon assets under `public/`.

### No proprietary backend

The current codebase does not implement an active application backend, user accounts, authentication, or a custom API server. Data acquisition happens directly from the browser to open data providers.

## Key Features

### Nearby fountain discovery

Oasis fetches fountains around the current or selected coordinate and filters them to the user-configured radius. The app always computes the nearest fountain and uses it to drive the proximity indicator, compass target, list ordering, and map polyline.

### Map-first field workflow

The main map view shows:

- the user position and accuracy ring,
- the selected target pin if the user taps the map,
- visible fountain markers only within the current viewport buffer,
- a dashed line to the nearest fountain when compass mode is active,
- custom zoom controls and map-style selection.

### Hydration safety indicator

The top status banner classifies the nearest water point into three practical thresholds:

- `<= 150 m`: Oasis
- `<= 500 m`: Safe
- `> 500 m`: Caution

This turns raw distance into an action-oriented signal suitable for mobile use.

### Compass guidance

When device orientation is available, the compass widget computes the bearing from the user's coordinates to the nearest fountain and rotates a needle smoothly using spring animation. This is intended for real-world directional guidance rather than decorative UI.

### List mode

List mode transforms the same fountain dataset into a ranked, scrollable set of cards with distance, estimated walking time, potability badge, and one-tap navigation.

### Offline behavior

Oasis now includes stronger offline support for Catalonia:

- the service worker preloads OpenStreetMap standard tiles for the Catalonia bounding box,
- the app caches previously requested same-origin assets,
- Overpass responses are cached for reuse,
- the UI automatically falls back to the standard basemap when the device is offline,
- fetched fountain datasets remain available in `localStorage`.

This means the app can continue showing a usable basemap in Catalonia without live internet connectivity, especially at the preloaded zoom levels.

## Architecture Summary

Oasis is a client-side React + TypeScript application. Its architecture is intentionally thin:

- `src/App.tsx` orchestrates application state, settings, and top-level view selection.
- `src/hooks/` contains browser capability integrations such as geolocation, device orientation, wake lock, network status, and fountain retrieval.
- `src/services/overpass.ts` encapsulates external data acquisition and short-lived in-memory caching.
- `src/components/` renders the map, list, compass, bottom sheet, badges, and error handling surfaces.
- `public/sw.js` handles offline caching and Catalonia tile prewarming.

The app follows a frontend-centric data flow:

1. Device location is acquired.
2. Fountain candidates are fetched from Overpass.
3. Features are normalized into the internal `Fountain` model.
4. Distances and nearest-target derivatives are computed client-side.
5. The result is rendered in map and list views.

For a full technical walkthrough, see [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md).

## Technical Stack

### Frontend

- React 19
- TypeScript
- Vite 6
- Tailwind CSS 4
- Leaflet + React Leaflet
- Lucide icons
- Motion for animated compass rotation

### Platform and packaging

- Progressive Web App support through Vite PWA tooling and a custom service worker strategy.
- Capacitor configuration for Android and iOS packaging.

### Data and connectivity

- OpenStreetMap / Overpass API
- Browser Geolocation API
- Device Orientation API
- Screen Wake Lock API
- Cache Storage API and `localStorage`

### Observability

- Vercel Analytics is mounted in the app shell.

## How to Run the Project

### Prerequisites

- Node.js 20+ recommended.
- npm 10+ recommended.

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

The app runs on port `3000` by default.

### Type-check the project

```bash
npm run lint
```

### Build for production

```bash
npm run build
```

### Capacitor mobile packaging

If you intend to package the app as a native shell:

```bash
npx cap sync
```

Additional platform commands such as `npx cap add android` or `npx cap add ios` depend on your local setup and are not currently encoded in the repository scripts.

## Environment Variables and API Keys

The current active frontend flow does not require application secrets or authenticated API keys.

Notes:

- The build config exposes `process.env.GEMINI_API_KEY`, but there is no active usage of Gemini in the shipped frontend code path.
- Overpass API is public and unauthenticated.

## System Design Highlights

### State management

State is managed with idiomatic React hooks rather than a global state library. This is sufficient because the domain is small and the state graph is local:

- persistent user preferences live in `localStorage`,
- operational UI state lives in `App.tsx`,
- device capability state lives inside dedicated hooks,
- derived values such as nearest fountain are computed with `useMemo`.

### Performance strategy

Key performance choices in the current implementation include:

- viewport-based marker rendering to avoid mounting every fountain marker at once,
- in-memory request caching for Overpass responses,
- distance-based refetch throttling tied to movement,
- canvas-preferred Leaflet rendering,
- cached tiles and same-origin assets for degraded networks.

### Data quality strategy

The app performs light but practical normalization:

- potability is inferred from multiple OSM tags,
- natural springs are classified separately from urban fountains,
- invalid coordinates are rejected before rendering,
- broken operational status is mapped when tagged in the source.

## Visual Experience

Oasis is not a dashboard product. It prioritizes field usability over dense analytics. There are no charts in the current version. Instead, visual communication is built through:

- colored fountain markers,
- safety-state banner thresholds,
- directional compass needle,
- distance badges,
- potability and spring badges,
- route polyline from the current target to the nearest fountain.

## Limitations

- Fountain completeness depends entirely on OpenStreetMap coverage and tagging quality.
- The offline basemap preload is limited to the OpenStreetMap standard layer for Catalonia.
- Very high zoom street-level tiles outside the preloaded range still depend on prior caching or connectivity.
- No clustering is implemented yet for extremely dense urban areas.
- No user reporting or source validation workflow exists for confirming whether a fountain is currently functional.

## Future Improvements

- Add explicit offline download progress and region management.
- Add fountain clustering for dense city centers.
- Add confidence scoring based on source tags and recency.
- Add richer operational-state inference for dry, closed, and maintenance conditions.
- Add curated regional datasets to complement OSM where quality gaps exist.
- Add automated tests around the Overpass normalization and offline caching behavior.

## Repository Structure

```text
.
├── public/                # Manifest, icons, and service worker
├── src/
│   ├── components/        # UI building blocks and map/list surfaces
│   ├── hooks/             # Browser/device/data hooks
│   ├── services/          # External data access
│   ├── utils/             # Geospatial utility functions
│   ├── App.tsx            # Main application composition
│   ├── main.tsx           # React bootstrap and service worker registration
│   ├── translations.ts    # Localized copy and distance formatting
│   └── types.ts           # Shared domain model types
├── capacitor.config.ts    # Native shell configuration
├── vite.config.ts         # Build and PWA configuration
└── TECHNICAL_GUIDE.md     # Detailed engineering guide
```

## Technical Guide

The complete engineering guide is available in [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md). It covers architecture, ETL flow, component responsibilities, caching strategy, feature-by-feature behavior, and current technical limitations in detail.
