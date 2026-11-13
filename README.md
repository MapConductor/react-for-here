English | [日本語](https://github.com/MapConductor/react-for-here/blob/main/README.ja.md) | [Español (Latinoamérica)](https://github.com/MapConductor/react-for-here/blob/main/README.es-419.md)

# @mapconductor/react-for-here

HERE Maps API for JavaScript provider for the MapConductor React SDK. Renders a
HERE map through MapConductor's provider-independent camera, marker, and
overlay API, so the same application code can also run on Google Maps,
MapLibre, Mapbox, Leaflet, OpenLayers, ArcGIS, or Cesium.

## Demo

[![Store map sample on HERE](https://raw.githubusercontent.com/MapConductor/react-for-here/main/docs/images/demo.jpg)](https://demo-react.mapconductor.com/here/map/en)

Open it in the [live demo](https://demo-react.mapconductor.com/here/map/en): the same store map runs on every provider, and the page switches between them. The code, cut down to three stores:

```tsx
import { useMemo, useState } from 'react';
import {
  createGeoPoint,
  createMapCameraPosition,
  createMarkerState,
  type MarkerState,
} from '@mapconductor/js-sdk-core';
import { InfoBubble, Markers } from '@mapconductor/js-sdk-react';
import { HereMapDesign, HereMapView2D, useHereViewState } from '@mapconductor/react-for-here';

const STORES = [
  { id: 'waikiki', name: 'Waikiki', latitude: 21.2793, longitude: -157.8292 },
  { id: 'kailua', name: 'Kailua', latitude: 21.3972, longitude: -157.7394 },
  { id: 'haleiwa', name: 'Haleiwa', latitude: 21.5928, longitude: -158.1034 },
];

const INITIAL_CAMERA = createMapCameraPosition({
  position: createGeoPoint({ latitude: 21.38, longitude: -157.93 }),
  zoom: 10,
});

export default function App() {
  const mapViewState = useHereViewState({
    mapDesignType: HereMapDesign.NormalDay,
    cameraPosition: INITIAL_CAMERA,
  });
  const platform = useMemo(
    () => new H.service.Platform({ apikey: 'YOUR_HERE_API_KEY' }),
    [],
  );
  const [selected, setSelected] = useState<MarkerState | null>(null);
  const markers = useMemo(
    () =>
      STORES.map(store =>
        createMarkerState({
          id: store.id,
          position: createGeoPoint({ latitude: store.latitude, longitude: store.longitude }),
          extra: store,
          onClick: marker => setSelected(marker),
        }),
      ),
    [],
  );

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <HereMapView2D state={mapViewState} platform={platform} onMapClick={() => setSelected(null)}>
        <Markers states={markers} />
        {selected && (
          <InfoBubble marker={selected}>
            <strong>{(selected.extra as (typeof STORES)[number]).name}</strong>
          </InfoBubble>
        )}
      </HereMapView2D>
    </div>
  );
}
```

Load the HERE Maps API scripts first (see [Loading the HERE Maps API](#loading-the-here-maps-api)) and replace `YOUR_HERE_API_KEY` with your own key.

## Installation

```shell
npm install @mapconductor/react-for-here
```

`@mapconductor/js-sdk-core` and `@mapconductor/js-sdk-react` (used for markers and
other shared components) are installed automatically as dependencies. Your
code imports from both directly, so with pnpm's strict (isolated)
`node_modules` — or whenever you prefer to declare everything you import —
install them explicitly instead:

```shell
npm install @mapconductor/react-for-here @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

## Loading the HERE Maps API

The HERE Maps API for JavaScript is not distributed via npm. Load it from
HERE's CDN in your host page; this package expects the `H` global those
scripts expose:

```html
<script src="https://js.api.here.com/v3/3.2/mapsjs-core.js"></script>
<script src="https://js.api.here.com/v3/3.2/mapsjs-service.js"></script>
<script src="https://js.api.here.com/v3/3.2/mapsjs-ui.js"></script>
<script src="https://js.api.here.com/v3/3.2/mapsjs-mapevents.js"></script>
<link rel="stylesheet" href="https://js.api.here.com/v3/3.2/mapsjs-ui.css" />
```

You also need an API key from the [HERE platform](https://platform.here.com/).

![](https://raw.githubusercontent.com/MapConductor/react-for-here/main/docs/images/hello-map.jpg)

## Hello Map tutorial

The simplest possible map app, built with MapConductor + HERE: click the
marker and a "Hello, MapConductor" bubble pops up. You can build it in the 5
steps below. HERE needs its API scripts loaded and an API key, so make sure
you've completed the CDN setup above before you start.

### Step 1: Create a React project

Create a React + TypeScript project with Vite.

```shell
npm create vite@latest hello-map -- --template react-ts
cd hello-map
npm install
npm run dev
```

### Step 2: Install MapConductor (HERE)

Install the package needed to show a map. We use HERE here, but you can use
other map modules too.

```shell
npm install @mapconductor/react-for-here
```

- `@mapconductor/react-for-here` — components / hooks for HERE
- `@mapconductor/js-sdk-react` / `@mapconductor/js-sdk-core` are installed
  automatically as dependencies.

### Step 3: Show the map

Create the map state with `useHereViewState` and render it with
`<HereMapView2D>`. HERE also needs a `platform` (an `H.service.Platform`)
instance, so create that too. Give the outer element a height to make it
full-screen.

```tsx
import { useMemo } from 'react';
import {
  HereMapDesign,
  HereMapView2D,
  useHereViewState,
} from '@mapconductor/react-for-here';
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';

// Your own key. Read it from your environment however your build tool does
// it, and keep it out of source control.
const HERE_API_KEY = '…';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useHereViewState({
    mapDesignType: HereMapDesign.NormalDay,
    cameraPosition: INITIAL_CAMERA,
  });
  // Create the platform yourself so your app keeps control of HERE credentials.
  const platform = useMemo(
    () => new H.service.Platform({ apikey: HERE_API_KEY }),
    [],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <HereMapView2D state={mapViewState} platform={platform} />
    </div>
  );
}
```

### Step 4: Place a marker

Create the marker state with `createMarkerState` and register it with
`<Marker>`. Write overlays as **child elements** of the map component.

```tsx
import { useMemo } from 'react';
import { createMarkerState } from '@mapconductor/js-sdk-core';
import { Marker } from '@mapconductor/js-sdk-react';

// ...inside App...
const marker = useMemo(
  () => createMarkerState({ id: 'hello', position: TOKYO }),
  [],
);

// ...inside return...
<HereMapView2D state={mapViewState} platform={platform}>
  <Marker state={marker} />
</HereMapView2D>
```

### Step 5: Show an InfoBubble on click

Track the selected state with `useState`, set it to true in the marker's
`onClick`, and render `<InfoBubble>` only while selected. This is the finished
app.

```tsx
import { useMemo, useState } from 'react';
import {
  HereMapDesign,
  HereMapView2D,
  useHereViewState,
} from '@mapconductor/react-for-here';
import {
  createGeoPoint,
  createMapCameraPosition,
  createMarkerState,
} from '@mapconductor/js-sdk-core';
import { InfoBubble, Marker } from '@mapconductor/js-sdk-react';

// Your own key. Read it from your environment however your build tool does
// it, and keep it out of source control.
const HERE_API_KEY = '…';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useHereViewState({
    mapDesignType: HereMapDesign.NormalDay,
    cameraPosition: INITIAL_CAMERA,
  });
  // Create the platform yourself so your app keeps control of HERE credentials.
  const platform = useMemo(
    () => new H.service.Platform({ apikey: HERE_API_KEY }),
    [],
  );

  const [selected, setSelected] = useState(false);

  const marker = useMemo(
    () => createMarkerState({
      id: 'hello',
      position: TOKYO,
      onClick: () => setSelected(true),
    }),
    [],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <HereMapView2D state={mapViewState} platform={platform} onMapClick={() => setSelected(false)}>
        <Marker state={marker} />
        {selected && (
          <InfoBubble marker={marker}>
            <div style={{ padding: '8px 12px', fontWeight: 600 }}>
              Hello, MapConductor
            </div>
          </InfoBubble>
        )}
      </HereMapView2D>
    </div>
  );
}
```

### Key points

- Coordinates, cameras and markers are created with `js-sdk-core` functions
  (**provider-independent**).
- The map component and hooks come from `react-for-here`
  (**provider-specific**).
- Write overlays as **child elements** of the map component.
- Control show / hide with React `useState`.

## Related packages

- [`@mapconductor/js-sdk-core`](https://github.com/mapconductor/js-sdk-core) — geometry, camera, and state primitives
- [`@mapconductor/js-sdk-react`](https://github.com/mapconductor/js-sdk-react) — shared `Marker`, `Markers`, shapes, and info bubbles
