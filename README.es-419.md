[English](./README.md) | [日本語](./README.ja.md) | Español (Latinoamérica)

# @mapconductor/react-for-here

Proveedor de HERE Maps API for JavaScript para el SDK de React de MapConductor. Renderiza un mapa de HERE a través de la API de cámara, marcadores y superposiciones independiente del proveedor de MapConductor, de modo que el mismo código de aplicación también puede ejecutarse en Google Maps, MapLibre, Mapbox, Leaflet, OpenLayers, ArcGIS o Cesium.

## Instalación

```shell
npm install @mapconductor/react-for-here
```

`@mapconductor/js-sdk-core` y `@mapconductor/js-sdk-react` (usados para marcadores y otros componentes compartidos) se instalan automáticamente como dependencias. Tu código importa directamente de ambos, así que con el `node_modules` estricto (aislado) de pnpm — o siempre que prefieras declarar todo lo que importas — instálalos explícitamente:

```shell
npm install @mapconductor/react-for-here @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

La HERE Maps API for JavaScript no se distribuye por npm. Cárgala desde el CDN de HERE en tu página host; este paquete espera el global `H` que esos scripts exponen:

```html
<script src="https://js.api.here.com/v3/3.1/mapsjs-core.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-core-legacy.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-service.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-ui.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-mapevents.js"></script>
<link rel="stylesheet" href="https://js.api.here.com/v3/3.1/mapsjs-ui.css" />
```

También necesitas una clave de API de la [plataforma HERE](https://platform.here.com/).

## Inicio rápido

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
  // Crea la plataforma tú mismo para que tu app mantenga el control de las credenciales de HERE.
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

Los niveles de zoom siguen la semántica de Google Maps; la API de JavaScript de HERE comparte la misma convención de zoom Web Mercator, por lo que los valores pasan sin cambios y la sincronización de cámara entre proveedores funciona sin configuración adicional.

## Diseños de mapa

`HereMapDesign` incluye `NormalDay`, `NormalNight`, `Satellite`, `HybridDay`, `HybridNight`, `LiteDay`, `LiteNight` y `LiteHybridDay`. Cambia en tiempo de ejecución asignando `state.mapDesignType = ...`.

## Paquetes relacionados

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — primitivas de geometría, cámara y estado
- [`@mapconductor/js-sdk-react`](../js-sdk-react) — `Marker`, `Markers`, formas y burbujas de información compartidos
