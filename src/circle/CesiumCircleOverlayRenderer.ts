import { ArcType, Cartesian3, ConstantPositionProperty, EllipseGraphics, Entity, PolylineGraphics } from 'cesium';
import {
  circleToRing,
  closeRing,
  type CircleAddParams,
  type CircleChangeParams,
  type CircleEntity,
  type CircleOverlayRenderer,
  type CircleState,
} from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from '../CesiumMapViewHolder';
import { toCesiumColor } from '../color';
import { toCartesian3 } from '../helpers';
import { cesiumEntityId } from '../entityId';
import { CIRCLE_Z_BASE } from '../zOrder';

export class CesiumCircleOverlayRenderer implements CircleOverlayRenderer<Entity> {
  constructor(readonly holder: CesiumMapViewHolder) {}
  async onAdd(data: CircleAddParams[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ state }) => this.create(state)); }
  async onChange(data: CircleChangeParams<Entity>[]): Promise<(Entity | null)[]> {
    if (this.holder.isDestroyed()) return data.map(() => null);
    return data.map(({ current, prev }) => { this.apply(prev.circle, current.state); return prev.circle; });
  }
  async onRemove(data: CircleEntity<Entity>[]): Promise<void> { if (!this.holder.isDestroyed()) data.forEach(item => this.holder.map.entities.remove(item.circle)); }
  async onPostProcess(): Promise<void> { if (!this.holder.isDestroyed()) this.holder.map.scene.requestRender(); }
  private create(state: CircleState): Entity { const entity = this.holder.map.entities.add(new Entity({ id: cesiumEntityId('circle', state.id) })); this.apply(entity, state); return entity; }
  private apply(entity: Entity, state: CircleState): void {
    entity.position = new ConstantPositionProperty(toCartesian3(state.center));
    // No height: the ellipse renders as ground geometry, which is what makes
    // Cesium honour zIndex ordering against other overlays (polylines sit in
    // a higher band; see zOrder.ts).
    entity.ellipse = new EllipseGraphics({ semiMajorAxis: state.radiusMeters, semiMinorAxis: state.radiusMeters, material: toCesiumColor(state.fillColor), outline: false, zIndex: CIRCLE_Z_BASE + (state.zIndex ?? 0) });
    // Geometry outlines are drawn with WebGL lineWidth, which is capped at
    // 1px on effectively every platform, so EllipseGraphics cannot honour
    // strokeWidth. Draw the outline as a clamped polyline ring instead —
    // polylines render as screen-aligned quads and support arbitrary widths.
    entity.polyline = state.strokeWidth > 0
      ? new PolylineGraphics({
          positions: circleOutlinePositions(state),
          width: state.strokeWidth,
          material: toCesiumColor(state.strokeColor),
          clampToGround: true,
          arcType: ArcType.GEODESIC,
          zIndex: CIRCLE_Z_BASE + (state.zIndex ?? 0),
        })
      : undefined;
  }
}

// Geodesic circle ring from the shared core geometry (128 segments, spherical
// destination formula). Tracks EllipseGraphics' ellipsoidal edge closely.
function circleOutlinePositions(state: CircleState): Cartesian3[] {
  return closeRing(circleToRing(state.center, state.radiusMeters, true)).map(
    (point) => Cartesian3.fromDegrees(point.longitude, point.latitude, 0),
  );
}
