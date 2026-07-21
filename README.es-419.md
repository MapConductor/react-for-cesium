[English](./README.md) | [日本語](./README.ja.md) | Español (Latinoamérica)

# @mapconductor/react-for-cesium

Proveedor de CesiumJS para el SDK de React de MapConductor. Renderiza un globo 3D de Cesium a través de la API de cámara, marcadores y superposiciones independiente del proveedor de MapConductor, de modo que el mismo código de aplicación también puede ejecutarse en Google Maps, MapLibre, Mapbox, Leaflet, OpenLayers, ArcGIS o HERE.

## Instalación

```shell
npm install @mapconductor/react-for-cesium
```

`@mapconductor/js-sdk-core` y `@mapconductor/js-sdk-react` (usados para marcadores y otros componentes compartidos) se instalan automáticamente como dependencias. Tu código importa directamente de ambos, así que con el `node_modules` estricto (aislado) de pnpm — o siempre que prefieras declarar todo lo que importas — instálalos explícitamente:

```shell
npm install @mapconductor/react-for-cesium @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

`cesium` viene incluido como dependencia; el diseño `Default` funciona sin token de Ion.

## Inicio rápido

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

La cámara usa la semántica de zoom de Google Maps; el paquete convierte internamente los niveles de zoom a altitud de cámara de Cesium, por lo que la sincronización de cámara entre proveedores funciona sin configuración adicional.

## Diseños de mapa

`CesiumDesign` incluye `Default` (imágenes integradas) y `None` (sin imágenes, p. ej. para tus propias capas). Cambia en tiempo de ejecución asignando `state.mapDesignType = ...`.

## Paquetes relacionados

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — primitivas de geometría, cámara y estado
- [`@mapconductor/js-sdk-react`](../js-sdk-react) — `Marker`, `Markers`, formas y burbujas de información compartidos
