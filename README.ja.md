[English](./README.md) | 日本語 | [Español (Latinoamérica)](./README.es-419.md)

# @mapconductor/react-for-cesium

MapConductor React SDK の CesiumJS プロバイダです。MapConductor のプロバイダ非依存なカメラ・マーカー・オーバーレイ API を通じて Cesium の 3D 地球儀を描画するため、同じアプリケーションコードが Google Maps、MapLibre、Mapbox、Leaflet、OpenLayers、ArcGIS、HERE でもそのまま動作します。

## インストール

```shell
npm install @mapconductor/react-for-cesium
```

`@mapconductor/js-sdk-core` と `@mapconductor/js-sdk-react`(マーカーなどの共有コンポーネントで使用)は依存関係として自動的にインストールされます。ただしアプリケーションコードはこの2つから直接 import するため、pnpm の strict(isolated)な `node_modules` を使う場合や、import するものをすべて明示的に宣言したい場合は、次のように明示的にインストールしてください:

```shell
npm install @mapconductor/react-for-cesium @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

`cesium` は依存関係として同梱されています。`Default` デザインは Ion トークンなしで動作します。

## クイックスタート

```tsx
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';
import { Marker } from '@mapconductor/js-sdk-react';
import {
  CesiumDesign,
  CesiumMapView,
  useCesiumMapViewState,
} from '@mapconductor/react-for-cesium';
import '@mapconductor/react-for-cesium/style.css';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });

export function App() {
  const state = useCesiumMapViewState({
    mapDesignType: CesiumDesign.Default,
    cameraPosition: createMapCameraPosition({ position: TOKYO, zoom: 12 }),
  });

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <CesiumMapView
        state={state}
        onMapClick={point => console.log('clicked', point.latitude, point.longitude)}
        onCameraMoveEnd={camera => console.log('zoom', camera.zoom)}
      >
        <Marker position={TOKYO} />
      </CesiumMapView>
    </div>
  );
}
```

カメラは Google Maps のズームセマンティクスを使用します。パッケージ内部でズームレベルを Cesium のカメラ高度に変換するため、プロバイダ間のカメラ同期がそのまま動作します。

## マップデザイン

`CesiumDesign` は `Default`(組み込みの画像タイル)と `None`(画像なし。独自のレイヤーを使う場合など)を提供します。実行時に切り替えるには `state.mapDesignType = ...` を代入します。

## 関連パッケージ

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — ジオメトリ・カメラ・状態のプリミティブ
- [`@mapconductor/js-sdk-react`](../js-sdk-react) — 共有の `Marker`・`Markers`・シェイプ・インフォバブル
