import { Cartesian2, Cartesian3, Cartographic, SceneTransforms, Math as CesiumMath, type Viewer } from 'cesium';
import { MapViewHolderBase, createGeoPoint, type GeoPoint, type GeoPointInterface, type Offset } from '@mapconductor/js-sdk-core';
import type { CesiumMapViewController } from './CesiumMapViewController';
import type { ZoomAltitudeConverter } from './zoom';

export class CesiumMapViewHolder extends MapViewHolderBase<HTMLElement, Viewer> {
  private controller: CesiumMapViewController | null = null;
  constructor(readonly mapView: HTMLElement, readonly map: Viewer, readonly zoomConverter: ZoomAltitudeConverter) { super(); }
  getController(): CesiumMapViewController | null { return this.controller; }
  setController(controller: CesiumMapViewController | null): void { this.controller = controller; }
  isDestroyed(): boolean { return this.map.isDestroyed(); }
  toScreenOffset(position: GeoPointInterface): Offset | null {
    if (this.isDestroyed()) return null;
    const point = SceneTransforms.worldToWindowCoordinates(this.map.scene, Cartesian3.fromDegrees(position.longitude, position.latitude));
    return point ? { x: point.x, y: point.y } : null;
  }
  fromScreenOffsetSync(offset: Offset): GeoPoint | null {
    if (this.isDestroyed()) return null;
    const cartesian = this.map.camera.pickEllipsoid(new Cartesian2(offset.x, offset.y), this.map.scene.globe.ellipsoid);
    if (!cartesian) return null;
    const p = Cartographic.fromCartesian(cartesian);
    return createGeoPoint({ longitude: CesiumMath.toDegrees(p.longitude), latitude: CesiumMath.toDegrees(p.latitude) });
  }
}
