English | [日本語](./README.ja.md) | [Español (Latinoamérica)](./README.es-419.md)

# @mapconductor/react-for-here

HERE Maps API for JavaScript provider for the MapConductor React SDK. Renders a
HERE map through MapConductor's provider-independent camera, marker, and
overlay API, so the same application code can also run on Google Maps,
MapLibre, Mapbox, Leaflet, OpenLayers, ArcGIS, or Cesium.

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

The HERE Maps API for JavaScript is not distributed via npm. Load it from
HERE's CDN in your host page; this package expects the `H` global those
scripts expose:

```html
<script src="https://js.api.here.com/v3/3.1/mapsjs-core.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-core-legacy.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-service.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-ui.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-mapevents.js"></script>
<link rel="stylesheet" href="https://js.api.here.com/v3/3.1/mapsjs-ui.css" />
```

You also need an API key from the [HERE platform](https://platform.here.com/).

## Quick start

```tsx
import { useMemo } from 'react';
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';
import { Marker } from '@mapconductor/js-sdk-react';
import {
  HereMapDesign,
  HereMapView2D,
  useHereViewState,
} from '@mapconductor/react-for-here';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });

export function App() {
  const state = useHereViewState({
    mapDesignType: HereMapDesign.NormalDay,
    cameraPosition: createMapCameraPosition({ position: TOKYO, zoom: 12 }),
  });
  // Create the platform yourself so your app keeps control of HERE credentials.
  const platform = useMemo(
    () => new H.service.Platform({ apikey: import.meta.env.VITE_HERE_API_KEY }),
    [],
  );

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <HereMapView2D
        state={state}
        platform={platform}
        onMapClick={point => console.log('clicked', point.latitude, point.longitude)}
        onCameraMoveEnd={camera => console.log('zoom', camera.zoom)}
      >
        <Marker position={TOKYO} />
      </HereMapView2D>
    </div>
  );
}
```

Zoom levels follow Google Maps semantics; HERE's JavaScript API shares the same
Web Mercator zoom convention, so values pass through unchanged and
cross-provider camera sync works out of the box.

## Map designs

`HereMapDesign` ships `NormalDay`, `NormalNight`, `Satellite`, `HybridDay`,
`HybridNight`, `LiteDay`, `LiteNight`, and `LiteHybridDay`. Switch at runtime by assigning
`state.mapDesignType = ...`.

## Related packages

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — geometry, camera, and state primitives
- [`@mapconductor/js-sdk-react`](../js-sdk-react) — shared `Marker`, `Markers`, shapes, and info bubbles
