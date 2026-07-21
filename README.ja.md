[English](./README.md) | 日本語 | [Español (Latinoamérica)](./README.es-419.md)

# @mapconductor/react-for-here

MapConductor React SDK の HERE Maps API for JavaScript プロバイダです。MapConductor のプロバイダ非依存なカメラ・マーカー・オーバーレイ API を通じて HERE の地図を描画するため、同じアプリケーションコードが Google Maps、MapLibre、Mapbox、Leaflet、OpenLayers、ArcGIS、Cesium でもそのまま動作します。

## インストール

```shell
npm install @mapconductor/react-for-here
```

`@mapconductor/js-sdk-core` と `@mapconductor/js-sdk-react`(マーカーなどの共有コンポーネントで使用)は依存関係として自動的にインストールされます。ただしアプリケーションコードはこの2つから直接 import するため、pnpm の strict(isolated)な `node_modules` を使う場合や、import するものをすべて明示的に宣言したい場合は、次のように明示的にインストールしてください:

```shell
npm install @mapconductor/react-for-here @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

HERE Maps API for JavaScript は npm では配布されていません。ホストページで HERE の CDN からロードしてください。本パッケージはこれらのスクリプトが公開するグローバル `H` を前提としています:

```html
<script src="https://js.api.here.com/v3/3.1/mapsjs-core.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-core-legacy.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-service.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-ui.js"></script>
<script src="https://js.api.here.com/v3/3.1/mapsjs-mapevents.js"></script>
<link rel="stylesheet" href="https://js.api.here.com/v3/3.1/mapsjs-ui.css" />
```

また、[HERE platform](https://platform.here.com/) の API キーが必要です。

## クイックスタート

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
  // HERE の認証情報をアプリ側で管理できるよう、platform は自分で作成します。
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

ズームレベルは Google Maps のセマンティクスに従います。HERE の JavaScript API は同じ Web Mercator ズーム規約を共有しているため、値はそのまま通り、プロバイダ間のカメラ同期がそのまま動作します。

## マップデザイン

`HereMapDesign` は `NormalDay`、`NormalNight`、`Satellite`、`HybridDay`、`HybridNight`、`LiteDay`、`LiteNight`、`LiteHybridDay` を提供します。実行時に切り替えるには `state.mapDesignType = ...` を代入します。

## 関連パッケージ

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — ジオメトリ・カメラ・状態のプリミティブ
- [`@mapconductor/js-sdk-react`](../js-sdk-react) — 共有の `Marker`・`Markers`・シェイプ・インフォバブル
