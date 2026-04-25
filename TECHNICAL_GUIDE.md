# Oasis Technical Guide

## 1. Project Overview

### 1.1 Purpose

Oasis is a location-aware hydration utility built as a mobile-first PWA. Its core responsibility is to identify and surface nearby water points with minimal interaction cost for users who are already moving through the physical world.

The product favors operational clarity over exploratory mapping. It is designed for use while running, cycling, walking, or navigating unfamiliar urban and peri-urban environments, where hydration decisions need to be made quickly and often under degraded connectivity conditions.

### 1.2 User problem addressed

The application solves a practical routing and safety problem:

- users often do not know where the next usable water source is,
- generic mapping products are noisy and require manual search,
- open data quality is uneven and must be normalized before display,
- mobile connectivity can be unreliable exactly when navigation is needed most.

### 1.3 Source data summary

Current production data inputs are:

- Overpass API JSON responses based on OpenStreetMap features.
- Device geolocation coordinates from the browser.
- Device orientation events for compass mode.
- Persistent browser storage for settings and cached fountain data.
- Service worker cache storage for app assets, map tiles, and API responses.

There are currently no GPX, CSV, or batch-import pipelines in the checked-in codebase. The system is operationally closer to a live geospatial query client than to a classical offline ETL platform with scheduled batch processing.

### 1.4 Key features

- Live geolocation tracking with follow-mode recentering.
- Interactive Leaflet map with custom fountain markers.
- Nearby fountain list sorted by distance.
- Potability and spring classification badges.
- Compass guidance toward the nearest fountain.
- Walking-time estimation.
- Multi-language support in Spanish, Catalan, and English.
- Metric and imperial units.
- Radius-based filtering from 100 m to 20 km.
- Offline caching of fetched data and prewarmed Catalonia basemap tiles.

## 2. Architecture and System Design

### 2.1 High-level architecture

Oasis uses a single-page frontend architecture with direct browser-to-provider communication. There is no application server in the active runtime path.

The architecture can be described in five layers:

1. Device capability layer
   - Geolocation
   - Orientation sensors
   - Wake lock
   - Vibration
   - Network status

2. Data acquisition layer
   - Overpass API mirror selection and fetch retries

3. Data normalization and derivation layer
   - OSM tag parsing
   - internal `Fountain` object creation
   - nearest-fountain and distance derivation
   - bearing and walking-time calculations

4. Presentation layer
   - Map view
   - List view
   - Fountain bottom sheet
   - Compass widget
   - Status banner and settings sheet

5. Offline and persistence layer
   - `localStorage` for settings and fountain snapshots
   - Service worker caches for assets, API responses, and map tiles

### 2.2 Module responsibilities

#### Application shell

- `src/main.tsx`
  - Bootstraps React.
  - Mounts analytics.
  - Registers the service worker.

- `src/App.tsx`
  - Owns the main UI state.
  - Persists user preferences.
  - Computes nearest fountain.
  - Chooses between map and list view.
  - Controls settings, selected fountain, compass mode, and custom map pin.

#### Hooks

- `src/hooks/useGeolocation.ts`
  - Starts a `watchPosition` subscription.
  - Maintains current user location.
  - Emits `mapCenterCommand` updates when follow mode is enabled.
  - Falls back to Madrid if geolocation is unavailable or fails before any fix.

- `src/hooks/useFountains.ts`
  - Coordinates fountain retrieval based on target location.
  - Prevents refetching until the user has moved more than half the fetch radius.
  - Persists the latest fetched result to `localStorage`.
  - Applies the user-selected search radius as a client-side filter.

- `src/hooks/useDeviceOrientation.ts`
  - Listens to `deviceorientationabsolute` and `deviceorientation` events.
  - Prefers absolute orientation when present.
  - Normalizes heading differences across platform conventions.

- `src/hooks/useNetworkStatus.ts`
  - Tracks browser online/offline state and drives UI fallback behavior.

- `src/hooks/useWakeLock.ts`
  - Requests screen wake lock and reacquires it when the tab returns to visibility.

- `src/hooks/useHaptics.ts`
  - Maps interaction types to vibration patterns.

#### Services and utilities

- `src/services/overpass.ts`
  - Maintains a rotating list of Overpass mirrors.
  - Handles `429 Too Many Requests` conditions by trying alternate mirrors.
  - Applies a 5-minute in-memory cache keyed by rounded coordinates and radius.
  - Normalizes Overpass elements into the internal domain model.

- `src/utils/distance.ts`
  - Computes great-circle distance with the Haversine formula.

- `src/translations.ts`
  - Centralizes localized strings and distance formatting rules.

#### UI components

- `src/components/Map.tsx`
  - Renders the basemap and all spatial overlays.
  - Chooses tile source based on map type and connectivity.
  - Restricts marker rendering to the visible viewport plus padding.
  - Draws user marker, custom pin, and dashed nearest-fountain line.

- `src/components/ListView.tsx`
  - Sorts fountains by distance.
  - Generates human-friendly walking-time estimates.
  - Launches external navigation.

- `src/components/FountainDetails.tsx`
  - Presents fountain details in a touch-driven bottom sheet.
  - Supports drag-to-dismiss.
  - Supports native navigation handoff and sharing.

- `src/components/CompassWidget.tsx`
  - Computes bearing to the nearest fountain.
  - Smooths rotation transitions with a spring animation.

- `src/components/PotabilityBadge.tsx`
  - Encodes the status badge design for potable, non-potable, unknown, and natural spring cases.

### 2.3 Data flow

The runtime flow is:

1. `useGeolocation` acquires the current coordinate.
2. `App.tsx` chooses the active target location.
   - Current location by default.
   - Custom map pin if the user taps the map.
3. `useFountains` calls `fetchFountainsAround` with a 10 km acquisition radius.
4. `overpass.ts` requests data from one of the Overpass mirrors.
5. Raw elements are transformed into `Fountain` objects.
6. `App.tsx` derives nearest fountain and minimum distance.
7. Map and list views render the filtered subset for the user-selected radius.
8. The service worker caches tiles and API responses for subsequent offline reuse.

### 2.4 State management approach

The project uses colocated React state rather than Redux, Zustand, or another external store. This is justified because:

- there is a single top-level user flow,
- no concurrent editing or server synchronization is required,
- state sharing is shallow and easy to lift into `App.tsx`,
- most computations are deterministic derivations of a small set of inputs.

State categories:

- Persistent settings state:
  - language
  - unit system
  - search radius
  - selected map type
- Volatile UI state:
  - selected fountain
  - settings sheet visibility
  - view mode
  - compass active state
  - follow mode
  - indicator dismissed state
- Sensor and data state:
  - geolocation
  - heading
  - online status
  - fetched fountains
  - loading state

### 2.5 API behavior

#### Overpass query model

The app performs radial point queries using the `around:` operator centered on the active target coordinate. This is appropriate for a proximity-based hydration tool because the user intent is distance-first, not region-first.

#### Retry and rate limiting strategy

The code handles Overpass operational constraints as follows:

- four mirrors are configured,
- HTTP `429` is treated as a capacity signal, not a terminal error,
- up to three rounds of retries are attempted,
- exponential backoff is applied between rounds.

#### Authentication

No authentication is required.

#### Pagination

No pagination exists because the Overpass query returns all matching nodes within the radius in a single response.

#### Caching

Caching exists at three levels:

- in-memory cache in `overpass.ts` with 5-minute TTL,
- `localStorage` cache of the latest fetched fountain list,
- service worker cache for API responses and map tiles.

## 3. ETL Pipeline

Although the application is not a batch data platform, it still contains a lightweight ETL-style client pipeline.

### 3.1 Ingestion

Data ingestion sources:

- browser geolocation stream,
- Overpass API JSON,
- device orientation events.

### 3.2 Cleaning

Cleaning and normalization steps include:

- reading `el.tags` defensively with fallback to `{}`,
- resolving potability from `drinking_water`, `potable`, and `amenity` tags,
- mapping `natural=spring` to a dedicated fountain type,
- mapping `operational_status=broken` to the `broken` status in the fetch layer,
- rejecting invalid coordinates before rendering.

### 3.3 Transformation

Transformations include:

- converting OSM node IDs to string identifiers,
- converting OSM longitude key `lon` into internal `lng`,
- rounding input coordinates to 3 decimals for request-cache keys,
- converting raw distances into metric or imperial display values,
- computing walking time from distance using a constant average walking speed,
- converting bearings into cardinal labels.

### 3.4 Feature extraction

Derived features produced by the client include:

- nearest fountain,
- minimum distance,
- safety-state class,
- route polyline endpoints,
- sorted rank order for list mode,
- viewport membership for render culling,
- orientation-relative needle rotation.

### 3.5 Visualization output

The final result is rendered in:

- map markers,
- list cards,
- badges,
- route line,
- compass needle,
- offline banner,
- status banner.

## 4. Detailed Feature Breakdown

### 4.1 Map view

#### What the user sees

- Basemap tiles.
- User location marker with optional heading cone.
- GPS accuracy ring.
- Nearby fountain markers.
- Optional custom pin after tapping the map.
- Dashed line to the nearest fountain when relevant.
- Floating zoom, locate, settings, compass, and map/list toggle controls.

#### What data it uses

- User location or selected custom location.
- Filtered fountain list.
- Current map type.
- Network status.
- Heading data.

#### What runs behind the scenes

- Validity checks prevent `NaN` coordinates from reaching Leaflet.
- Marker rendering is limited to the current bounds padded by 40%.
- A fly-to command is emitted when follow mode or explicit recentering is requested.
- The map type falls back to `standard` when offline so that cached OSM tiles remain usable.

#### User insight delivered

The user gets immediate spatial context: where they are, where water sources are, and which source is closest.

#### Interactive elements

- Tap map to set a custom target location.
- Tap marker to open fountain details.
- Toggle map style.
- Use zoom buttons.
- Recenter on current location.

### 4.2 Hydration indicator

#### What the user sees

A top banner that communicates one of three proximity states or a no-results state.

#### Data used

- nearest fountain,
- minimum distance,
- loading state,
- target location,
- current search radius,
- translation strings.

#### Transformation logic

- Distance is bucketed into three operational thresholds.
- Text changes based on whether the target is the live GPS position or a custom pin.

#### User insight delivered

The banner abstracts a numeric distance into an action-oriented hydration safety interpretation.

### 4.3 List view

#### What the user sees

A vertically scrollable list of nearby fountains sorted by distance.

#### Data used

- filtered fountains,
- target location,
- unit system,
- translation strings.

#### Transformations and algorithms

- Haversine distance is computed per fountain.
- Entries are sorted ascending by distance.
- Walking time is estimated from a fixed 4 km/h walking speed.
- Distance is color-coded into badge states.

#### User insight delivered

The list offers a non-map decision surface optimized for quick ranking and route launching.

#### Interactions

- One-tap external navigation.
- Scrollable browsing.

### 4.4 Fountain details bottom sheet

#### What the user sees

A bottom sheet containing fountain type, potability badge, distance, approximate walking time, navigation action, and share action.

#### Data used

- selected fountain,
- user or custom target location,
- translation strings,
- unit system.

#### Transformations and algorithms

- Distance recomputation for the selected fountain.
- Walking-time estimate from the same distance.
- Platform-specific routing handoff:
  - Android: `geo:` URI
  - iOS: Apple Maps URL
  - desktop and other fallback: Google Maps web URL

#### User insight delivered

It converts a map marker into an actionable decision panel.

#### Interactions

- Tap outside to dismiss.
- Drag down to dismiss.
- Open navigation.
- Share or copy location link.

### 4.5 Compass widget

#### What the user sees

A compact button when inactive, and an animated directional widget when active.

#### Data used

- current heading,
- user coordinates,
- nearest fountain coordinates.

#### Transformations and algorithms

- Great-circle initial bearing computation.
- Relative angle derivation by subtracting current heading from target bearing.
- shortest-rotation smoothing to avoid large visual jumps across the 0/360 boundary.
- cardinal direction conversion for a compact label.

#### User insight delivered

It provides directional guidance without requiring the user to visually interpret the full map during movement.

### 4.6 Settings sheet

#### What the user sees

A bottom sheet containing language, units, search radius, map type, and wake-lock toggle controls.

#### Data used

- persisted settings state in `localStorage`.

#### Transformations and algorithms

- Direct persistence of selections.
- No server synchronization.

#### User insight delivered

This controls the app's operational behavior, especially search radius and offline-compatible map style selection.

## 5. Data Engineering Details

### 5.1 Data cleaning steps

- Defensive parsing of OSM tags.
- Multi-tag inference for potability.
- Category mapping for natural springs.
- Status mapping for broken features.
- Coordinate validation before spatial rendering.

### 5.2 Missing values

Missing or ambiguous values are handled by conservative fallback rather than aggressive imputation:

- unknown potability becomes `unknown`,
- missing description becomes `null`,
- missing operational tags default to a working-style assumption in the fetch layer unless explicitly tagged broken,
- absent sensor data disables the compass rather than fabricating orientation.

### 5.3 Outliers and noise

There is no heavy denoising pipeline, but the code contains simple pragmatic protections:

- invalid numeric coordinates are filtered out at render time,
- geolocation updates are consumed as-is from the browser,
- orientation logic prefers `deviceorientationabsolute` when available to reduce arbitrary relative alpha noise,
- map refetching is gated by movement threshold to avoid unnecessary burst traffic on jitter alone.

### 5.4 Aggregations and windows

Current aggregations are lightweight and request-scoped:

- nearest-neighbor reduction over fetched fountains,
- sorted ranking by distance,
- movement-threshold gating based on the last fetched location.

There are no rolling windows, temporal dashboards, historical trend lines, or smoothing pipelines because the product is currently real-time and task-specific rather than analytical.

### 5.5 Domain-specific metrics

Implemented metrics:

- Haversine distance in kilometers.
- Converted display distance in meters, kilometers, feet, or miles.
- Approximate walking time using a constant speed model.
- Direction bearing and cardinal heading.

Not implemented:

- elevation,
- slope,
- pace,
- heart-rate zones,
- route clustering,
- quality scoring,
- source confidence ranking.

## 6. Machine Learning and Analytics

There is no machine learning pipeline in the current checked-in application.

### 6.1 What is not present

- No clustering.
- No PCA.
- No regression.
- No route prediction.
- No SHAP or explainability layer.
- No anomaly detection.
- No recommendation model.

### 6.2 Why this matters

It is important to state this explicitly because the user experience may look data-rich, but the current system is a deterministic geospatial utility, not an ML product. The main value comes from spatial filtering, geodesic calculations, open-data normalization, and mobile interaction design.

### 6.3 Appropriate future analytics directions

If analytics are added later, the most practical first steps would be:

- confidence scoring from tag combinations and edit recency,
- density clustering for urban fountain heatmaps,
- reliability ranking based on user confirmations,
- offline route-aware fountain recommendation.

## 7. Visualizations

### 7.1 Map visualization

Technology:

- Leaflet
- React Leaflet

What it shows:

- basemap context,
- user position,
- fountain positions,
- nearest-fountain relationship.

How it is computed:

- fountain coordinates from normalized Overpass records,
- user coordinates from geolocation,
- route line from `[targetLocation, nearestFountain]`.

Why it is useful:

- fastest spatial understanding for real-world navigation.

### 7.2 Compass visualization

Technology:

- Motion spring animation
- browser orientation sensors

What it shows:

- instantaneous direction to the nearest fountain relative to current device heading.

How it is computed:

- target bearing minus device heading, normalized to a stable shortest path rotation.

Why it is useful:

- supports quick orientation while walking or cycling.

### 7.3 List visualization

Technology:

- React card list
- Tailwind styling

What it shows:

- ranked nearby options with concise metadata.

How it is computed:

- distance calculation plus ascending sort.

Why it is useful:

- works well when the user wants the nearest viable option without map exploration.

### 7.4 Status visualization

Technology:

- color-coded banner states and badges.

What it shows:

- operational interpretation of distance and water quality metadata.

How it is computed:

- threshold bucketing and tag classification.

Why it is useful:

- reduces cognitive load in motion-heavy contexts.

## 8. Technical Stack

### 8.1 Languages and frameworks

- TypeScript
- React 19
- Vite 6

### 8.2 UI and rendering

- Tailwind CSS 4
- Leaflet
- React Leaflet
- Lucide React
- Motion
- clsx

### 8.3 Platform APIs

- Geolocation API
- Device Orientation API
- Vibration API
- Wake Lock API
- Service Worker API
- Cache Storage API

### 8.4 PWA and deployment posture

- Manifest-based installability.
- Service worker registration at app bootstrap.
- Offline caching strategy implemented in `public/sw.js`.
- Vite PWA plugin present in the build configuration.

### 8.5 Backend status

There is no active custom backend in the current runtime path.

The `package.json` contains some server-side packages that are not referenced by the current frontend source tree. Those should be treated as dormant or future-facing dependencies until real server code exists.

## 9. How to Run the Project

### 9.1 Local development

```bash
npm install
npm run dev
```

### 9.2 Quality checks

```bash
npm run lint
```

### 9.3 Production build

```bash
npm run build
```

### 9.4 Mobile packaging

```bash
npx cap sync
```

### 9.5 Environment variables

No environment variables are required for the active app flow.

### 9.6 API keys

No API keys are required for Overpass access in the current implementation.

## 10. Advanced Notes

### 10.1 Performance considerations

- Marker virtualization by viewport is one of the most important performance controls in the app.
- Fountain fetches are debounced by movement threshold rather than firing on every GPS update.
- The current list view recomputes distances on render, which is acceptable for the present scale but could be memoized more aggressively if larger datasets are introduced.
- Prewarming Catalonia map tiles improves offline usability but increases initial cache footprint.
- The app uses `preferCanvas` in Leaflet to improve rendering behavior on constrained mobile devices.

### 10.2 Offline architecture notes

The service worker now performs four main jobs:

- precaches a minimal app shell,
- preloads OSM standard tiles covering Catalonia,
- caches same-origin assets on demand,
- caches Overpass responses for fallback reuse.

Important boundary:

- offline map reliability is best for the standard OSM layer,
- alternative layers such as satellite, terrain, light, and dark are not prewarmed for region-wide use,
- deeper zoom levels beyond the preloaded range remain dependent on prior browsing or connectivity.

### 10.3 Known issues and edge cases

- If geolocation fails before any fix, the app falls back to Madrid. This is a safe functional fallback but not ideal for a Catalonia-focused user base.
- The `FountainStatus` type definition and the normalized fetch status values are not perfectly aligned in the current codebase. The UI does not currently exploit those extended states, so the mismatch is not user-visible, but it is technical debt worth normalizing.
- OSM feature tagging can be incomplete, especially for potability and operational status.
- The app has no explicit download progress UI for offline tile prewarming.
- No automated tests currently validate the service worker or Overpass transformation logic.

### 10.4 Recommended future improvements

1. Replace the Madrid fallback with a Catalonia-aware or last-known-location fallback.
2. Add explicit offline region management with progress, storage estimation, and cache reset controls.
3. Introduce marker clustering and possibly vector tiles for dense urban areas.
4. Normalize the status type model so fetch-layer outputs and shared types match exactly.
5. Add test coverage for distance calculations, Overpass normalization, and service worker request handling.
6. Consider a curated regional fountain dataset to complement OSM in areas with incomplete tagging.
