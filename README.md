English | [日本語](./README.ja.md) | [Español (Latinoamérica)](./README.es-419.md)

# @mapconductor/react-for-cesium

CesiumJS provider for the MapConductor React SDK. Renders a Cesium 3D globe
through MapConductor's provider-independent camera, marker, and overlay API, so
the same application code can also run on Google Maps, MapLibre, Mapbox,
Leaflet, OpenLayers, ArcGIS, or HERE.

## Installation

```shell
npm install @mapconductor/react-for-cesium
```

`@mapconductor/js-sdk-core` and `@mapconductor/js-sdk-react` (used for markers and
other shared components) are installed automatically as dependencies. Your
code imports from both directly, so with pnpm's strict (isolated)
`node_modules` — or whenever you prefer to declare everything you import —
install them explicitly instead:

```shell
npm install @mapconductor/react-for-cesium @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

`cesium` is bundled as a dependency; the `Default` design works without an
Ion token.

## Quick start

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

The camera uses Google Maps zoom semantics; the package converts zoom levels to
Cesium camera altitude internally, so cross-provider camera sync works out of
the box.

## Map designs

`CesiumDesign` ships `Default` (built-in imagery) and `None` (no imagery, e.g.
for your own layers). Switch at runtime by assigning
`state.mapDesignType = ...`.

## Related packages

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — geometry, camera, and state primitives
- [`@mapconductor/js-sdk-react`](../js-sdk-react) — shared `Marker`, `Markers`, shapes, and info bubbles
