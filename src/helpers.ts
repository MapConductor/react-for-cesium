import { Cartesian3 } from 'cesium';
import type { GeoPointInterface } from '@mapconductor/js-sdk-core';

export function toCartesian3(point: GeoPointInterface): Cartesian3 {
  return Cartesian3.fromDegrees(point.longitude, point.latitude, point.altitude ?? 0);
}

export function pointsToDegrees(points: readonly GeoPointInterface[]): number[] {
  return points.flatMap(point => [point.longitude, point.latitude]);
}
