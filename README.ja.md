[English](https://github.com/MapConductor/react-for-here/README.md) | 日本語 | [Español (Latinoamérica)](https://github.com/MapConductor/react-for-here/README.es-419.md)

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

## HERE Maps API の読み込み

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

![](https://raw.githubusercontent.com/mapconductor/react-for-here/docs/images/hello-map.jpg)

## Hello Map チュートリアル

MapConductor + HERE で作る、いちばん簡単な地図アプリです。マーカーをクリックすると「Hello, MapConductor」の吹き出しが出ます。この地図は、次の 5 ステップで作れます。HERE は API スクリプトの読み込みと API キーが必要なので、始める前に上記の CDN 設定を済ませておいてください。

### ステップ 1: React プロジェクトを作る

Vite で React + TypeScript のプロジェクトを作成します。

```shell
npm create vite@latest hello-map -- --template react-ts
cd hello-map
npm install
npm run dev
```

### ステップ 2: MapConductor（HERE）をインストール

地図表示に必要なパッケージを入れます。ここでは HERE を使いますが、他の地図モジュールを使うこともできます。

```shell
npm install @mapconductor/react-for-here
```

- `@mapconductor/react-for-here` — HERE 用のコンポーネント/フック
- `@mapconductor/js-sdk-react` / `@mapconductor/js-sdk-core` は依存関係として自動的にインストールされます。

### ステップ 3: 地図を表示する

`useHereViewState` で地図の状態を作り、`<HereMapView2D>` で描画します。HERE では `platform`(`H.service.Platform` のインスタンス)も必要なので、あわせて作成します。外側の要素に高さを与えると全画面になります。

```tsx
import { useMemo } from 'react';
import {
  HereMapDesign,
  HereMapView2D,
  useHereViewState,
} from '@mapconductor/react-for-here';
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useHereViewState({
    mapDesignType: HereMapDesign.NormalDay,
    cameraPosition: INITIAL_CAMERA,
  });
  // プラットフォームは自分で生成し、HERE の認証情報をアプリ側で管理します。
  const platform = useMemo(
    () => new H.service.Platform({ apikey: import.meta.env.VITE_HERE_API_KEY }),
    [],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <HereMapView2D state={mapViewState} platform={platform} />
    </div>
  );
}
```

### ステップ 4: マーカーを置く

`createMarkerState` でマーカーの状態を作り、`<Marker>` で登録します。オーバーレイは地図コンポーネントの**子要素**として書きます。

```tsx
import { useMemo } from 'react';
import { createMarkerState } from '@mapconductor/js-sdk-core';
import { Marker } from '@mapconductor/js-sdk-react';

// ...App の中...
const marker = useMemo(
  () => createMarkerState({ id: 'hello', position: TOKYO }),
  [],
);

// ...return の中...
<HereMapView2D state={mapViewState} platform={platform}>
  <Marker state={marker} />
</HereMapView2D>
```

### ステップ 5: クリックで InfoBubble を表示する

選択中かどうかを `useState` で持ち、マーカーの `onClick` で true にします。選択中のときだけ `<InfoBubble>` を描画します。これが完成形です。

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

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useHereViewState({
    mapDesignType: HereMapDesign.NormalDay,
    cameraPosition: INITIAL_CAMERA,
  });
  // プラットフォームは自分で生成し、HERE の認証情報をアプリ側で管理します。
  const platform = useMemo(
    () => new H.service.Platform({ apikey: import.meta.env.VITE_HERE_API_KEY }),
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

### ポイント

- 座標・カメラ・マーカーは `js-sdk-core` の関数で作る(**プロバイダー非依存**)
- 地図コンポーネントとフックは `react-for-here` から来る(**プロバイダー固有**)
- オーバーレイは地図コンポーネントの**子要素**として書く
- 表示・非表示は React の `useState` で制御する

## 関連パッケージ

- [`@mapconductor/js-sdk-core`](https://github.com/mapconductor/js-sdk-core) — ジオメトリ・カメラ・状態のプリミティブ
- [`@mapconductor/js-sdk-react`](https://github.com/mapconductor/js-sdk-react) — 共有の `Marker`・`Markers`・シェイプ・インフォバブル
