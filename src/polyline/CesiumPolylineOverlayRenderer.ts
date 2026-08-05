import { Entity, PolylineGraphics } from 'cesium';
import { WGS84Geodesic, Planar, type PolylineAddParams, type PolylineChangeParams, type PolylineEntity, type PolylineOverlayRenderer, type PolylineState } from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from '../CesiumMapViewHolder';
import { toCesiumColor } from '../color';
import { pointsToDegrees } from '../helpers';
import { Cartesian3 } from 'cesium';
import { cesiumEntityId } from '../entityId';
import { POLYLINE_Z_BASE } from '../zOrder';

export class CesiumPolylineOverlayRenderer implements PolylineOverlayRenderer<Entity> {
  constructor(readonly holder: CesiumMapViewHolder) {}
  async onAdd(data: PolylineAddParams[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ state }) => this.create(state)); }
  async onChange(data: PolylineChangeParams<Entity>[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ current, prev }) => { this.apply(prev.polyline, current.state); return prev.polyline; }); }
  async onRemove(data: PolylineEntity<Entity>[]): Promise<void> { if (!this.holder.isDestroyed()) data.forEach(item => this.holder.map.entities.remove(item.polyline)); }
  async onPostProcess(): Promise<void> { if (!this.holder.isDestroyed()) this.holder.map.scene.requestRender(); }
  private create(state: PolylineState): Entity { const entity = this.holder.map.entities.add(new Entity({ id: cesiumEntityId('polyline', state.id) })); this.apply(entity, state); return entity; }
  private apply(entity: Entity, state: PolylineState): void {
    if (state.points.length < 2) {
      entity.polyline = undefined;
      return;
    }
    // Cesium always connects vertices with geodesic arcs, so a geodesic:false
    // polyline built from the raw vertices would coincide with the geodesic
    // one and never show its straight-line path. Mirror react-for-arcgis:
    // densify the path ourselves — great-circle interpolation when geodesic,
    // linear lon/lat interpolation (Google Maps' straight-line semantics)
    // otherwise. At this density the arc type between neighbours is moot.
    const points = state.geodesic
      ? WGS84Geodesic.createInterpolatePoints(state.points)
      : Planar.createInterpolatePoints(state.points);
    entity.polyline = new PolylineGraphics({
      positions: Cartesian3.fromDegreesArray(pointsToDegrees(points)),
      width: state.strokeWidth,
      material: toCesiumColor(state.strokeColor),
      clampToGround: true,
      zIndex: POLYLINE_Z_BASE + state.zIndex,
    });
  }
}
