English | [日本語](https://github.com/MapConductor/react-for-cesium/README.ja.md) | [Español (Latinoamérica)](https://github.com/MapConductor/react-for-cesium/README.es-419.md)

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

`cesium` is bundled as a dependency; the `Default` design works without an Ion
token.

![](https://raw.githubusercontent.com/mapconductor/react-for-cesium/docs/images/hello-map.jpg)

## Hello Map tutorial

The simplest possible map app, built with MapConductor + Cesium: click the
marker and a "Hello, MapConductor" bubble pops up. You can build it in the 5
steps below. The `Default` design works without a Cesium Ion token, so you can
copy-paste and it just works.

### Step 1: Create a React project

Create a React + TypeScript project with Vite.

```shell
npm create vite@latest hello-map -- --template react-ts
cd hello-map
npm install
npm run dev
```

### Step 2: Install MapConductor (Cesium)

Install the package needed to show a map. We use Cesium here, but you can use
other map modules too.

```shell
npm install @mapconductor/react-for-cesium
```

- `@mapconductor/react-for-cesium` — components / hooks for Cesium
- `@mapconductor/js-sdk-react` / `@mapconductor/js-sdk-core` are installed
  automatically as dependencies.

### Step 3: Show the map

Create the map state with `useCesiumMapViewState` and render it with
`<CesiumMapView>`. Don't forget the style CSS import. Give the outer element a
height to make it full-screen.

```tsx
import {
  CesiumDesign,
  CesiumMapView,
  useCesiumMapViewState,
} from '@mapconductor/react-for-cesium';
import '@mapconductor/react-for-cesium/style.css';
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useCesiumMapViewState({
    mapDesignType: CesiumDesign.Default,
    cameraPosition: INITIAL_CAMERA,
  });

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CesiumMapView state={mapViewState} />
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
<CesiumMapView state={mapViewState}>
  <Marker state={marker} />
</CesiumMapView>
```

### Step 5: Show an InfoBubble on click

Track the selected state with `useState`, set it to true in the marker's
`onClick`, and render `<InfoBubble>` only while selected. This is the finished
app.

```tsx
import { useMemo, useState } from 'react';
import {
  CesiumDesign,
  CesiumMapView,
  useCesiumMapViewState,
} from '@mapconductor/react-for-cesium';
import '@mapconductor/react-for-cesium/style.css';
import {
  createGeoPoint,
  createMapCameraPosition,
  createMarkerState,
} from '@mapconductor/js-sdk-core';
import { InfoBubble, Marker } from '@mapconductor/js-sdk-react';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useCesiumMapViewState({
    mapDesignType: CesiumDesign.Default,
    cameraPosition: INITIAL_CAMERA,
  });

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
      <CesiumMapView state={mapViewState} onMapClick={() => setSelected(false)}>
        <Marker state={marker} />
        {selected && (
          <InfoBubble marker={marker}>
            <div style={{ padding: '8px 12px', fontWeight: 600 }}>
              Hello, MapConductor
            </div>
          </InfoBubble>
        )}
      </CesiumMapView>
    </div>
  );
}
```

### Key points

- Coordinates, cameras and markers are created with `js-sdk-core` functions
  (**provider-independent**).
- The map component and hooks come from `react-for-cesium`
  (**provider-specific**).
- Write overlays as **child elements** of the map component.
- Control show / hide with React `useState`.

## Related packages

- [`@mapconductor/js-sdk-core`](https://github.com/mapconductor/js-sdk-core) — geometry, camera, and state primitives
- [`@mapconductor/js-sdk-react`](https://github.com/mapconductor/js-sdk-react) — shared `Marker`, `Markers`, shapes, and info bubbles
