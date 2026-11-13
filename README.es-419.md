[English](https://github.com/MapConductor/react-for-here/blob/main/README.md) | [日本語](https://github.com/MapConductor/react-for-here/blob/main/README.ja.md) | Español (Latinoamérica)

# @mapconductor/react-for-here

Proveedor de HERE Maps API for JavaScript para el SDK de React de MapConductor. Renderiza un mapa de HERE a través de la API de cámara, marcadores y superposiciones independiente del proveedor de MapConductor, de modo que el mismo código de aplicación también puede ejecutarse en Google Maps, MapLibre, Mapbox, Leaflet, OpenLayers, ArcGIS o Cesium.

## Demostración

[![Ejemplo de mapa de tiendas con HERE](https://raw.githubusercontent.com/MapConductor/react-for-here/main/docs/images/demo.jpg)](https://demo-react.mapconductor.com/here/map/en)

Ábrelo en la [demo en vivo](https://demo-react.mapconductor.com/here/map/en): el mismo mapa de tiendas funciona con todos los proveedores y la página cambia entre ellos. El código, reducido a tres tiendas:

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

Carga primero los scripts de la API de HERE Maps (consulta [Carga de la HERE Maps API for JavaScript](#carga-de-la-here-maps-api-for-javascript)) y reemplaza `YOUR_HERE_API_KEY` con tu propia clave.

## Instalación

```shell
npm install @mapconductor/react-for-here
```

`@mapconductor/js-sdk-core` y `@mapconductor/js-sdk-react` (usados para marcadores y otros componentes compartidos) se instalan automáticamente como dependencias. Tu código importa directamente de ambos, así que con el `node_modules` estricto (aislado) de pnpm — o siempre que prefieras declarar todo lo que importas — instálalos explícitamente:

```shell
npm install @mapconductor/react-for-here @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

## Carga de la HERE Maps API for JavaScript

La HERE Maps API for JavaScript no se distribuye por npm. Cárgala desde el CDN de HERE en tu página host; este paquete espera el global `H` que esos scripts exponen:

```html
<script src="https://js.api.here.com/v3/3.2/mapsjs-core.js"></script>
<script src="https://js.api.here.com/v3/3.2/mapsjs-service.js"></script>
<script src="https://js.api.here.com/v3/3.2/mapsjs-ui.js"></script>
<script src="https://js.api.here.com/v3/3.2/mapsjs-mapevents.js"></script>
<link rel="stylesheet" href="https://js.api.here.com/v3/3.2/mapsjs-ui.css" />
```

También necesitas una clave de API de la [plataforma HERE](https://platform.here.com/).

![](https://raw.githubusercontent.com/MapConductor/react-for-here/main/docs/images/hello-map.jpg)

## Tutorial Hello Map

La aplicación de mapa más sencilla posible, creada con MapConductor + HERE: haz clic en el marcador y aparecerá un globo "Hello, MapConductor". Puedes crear este mapa en los 5 pasos siguientes. HERE necesita que cargues sus scripts de API y una clave de API, así que asegúrate de haber completado la configuración del CDN anterior antes de empezar.

### Paso 1: Crea un proyecto React

Crea un proyecto React + TypeScript con Vite.

```shell
npm create vite@latest hello-map -- --template react-ts
cd hello-map
npm install
npm run dev
```

### Paso 2: Instala MapConductor (HERE)

Instala el paquete necesario para mostrar un mapa. Aquí usamos HERE, pero también puedes usar otros módulos de mapas.

```shell
npm install @mapconductor/react-for-here
```

- `@mapconductor/react-for-here` — componentes / hooks para HERE
- `@mapconductor/js-sdk-react` / `@mapconductor/js-sdk-core` se instalan
  automáticamente como dependencias.

### Paso 3: Muestra el mapa

Crea el estado del mapa con `useHereViewState` y renderízalo con `<HereMapView2D>`. HERE también necesita una instancia de `platform` (un `H.service.Platform`), así que créala también. Da una altura al elemento externo para que ocupe toda la pantalla.

```tsx
import { useMemo } from 'react';
import {
  HereMapDesign,
  HereMapView2D,
  useHereViewState,
} from '@mapconductor/react-for-here';
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';

// Tu propia clave. Léela del entorno con el mecanismo de tu herramienta de
// compilación y mantenla fuera del control de versiones.
const HERE_API_KEY = '…';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useHereViewState({
    mapDesignType: HereMapDesign.NormalDay,
    cameraPosition: INITIAL_CAMERA,
  });
  // Crea la plataforma tú mismo para que tu app controle las credenciales de HERE.
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

### Paso 4: Coloca un marcador

Crea el estado del marcador con `createMarkerState` y regístralo con `<Marker>`. Escribe las superposiciones como **elementos hijos** del componente del mapa.

```tsx
import { useMemo } from 'react';
import { createMarkerState } from '@mapconductor/js-sdk-core';
import { Marker } from '@mapconductor/js-sdk-react';

// ...dentro de App...
const marker = useMemo(
  () => createMarkerState({ id: 'hello', position: TOKYO }),
  [],
);

// ...dentro de return...
<HereMapView2D state={mapViewState} platform={platform}>
  <Marker state={marker} />
</HereMapView2D>
```

### Paso 5: Muestra un InfoBubble al hacer clic

Guarda el estado de selección con `useState`, ponlo en true en el `onClick` del marcador y renderiza `<InfoBubble>` solo mientras está seleccionado. Este es el resultado final.

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

// Tu propia clave. Léela del entorno con el mecanismo de tu herramienta de
// compilación y mantenla fuera del control de versiones.
const HERE_API_KEY = '…';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useHereViewState({
    mapDesignType: HereMapDesign.NormalDay,
    cameraPosition: INITIAL_CAMERA,
  });
  // Crea la plataforma tú mismo para que tu app controle las credenciales de HERE.
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

### Puntos clave

- Las coordenadas, cámaras y marcadores se crean con funciones de `js-sdk-core`
  (**independiente del proveedor**).
- El componente del mapa y los hooks vienen de `react-for-here`
  (**específico del proveedor**).
- Escribe las superposiciones como **elementos hijos** del componente del mapa.
- Controla mostrar / ocultar con `useState` de React.

## Paquetes relacionados

- [`@mapconductor/js-sdk-core`](https://github.com/mapconductor/js-sdk-core) — primitivas de geometría, cámara y estado
- [`@mapconductor/js-sdk-react`](https://github.com/mapconductor/js-sdk-react) — `Marker`, `Markers`, formas y burbujas de información compartidos
