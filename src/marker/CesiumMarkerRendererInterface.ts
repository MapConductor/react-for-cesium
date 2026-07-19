import type { Entity } from 'cesium';
import type { GeoPoint, MarkerEntity, MarkerOverlayRenderer } from '@mapconductor/js-sdk-core';

export interface CesiumMarkerRendererInterface extends MarkerOverlayRenderer<Entity> {
  setMarkerPosition(entity: MarkerEntity<Entity>, position: GeoPoint): void;
}
