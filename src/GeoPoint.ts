import { Cartographic, Math as CesiumMath } from 'cesium';
import { createGeoPoint, type GeoPoint } from '@mapconductor/js-sdk-core';

export function fromCartographic(value: Cartographic): GeoPoint {
  return createGeoPoint({
    longitude: CesiumMath.toDegrees(value.longitude),
    latitude: CesiumMath.toDegrees(value.latitude),
    altitude: value.height,
  });
}
