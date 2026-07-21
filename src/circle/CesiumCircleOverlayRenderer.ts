import { ArcType, Cartesian3, ConstantPositionProperty, EllipseGraphics, Entity, PolylineGraphics } from 'cesium';
import {
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

const CIRCLE_OUTLINE_SEGMENTS = 128;
const WGS84_SEMI_MAJOR_M = 6_378_137;
const WGS84_E2 = 0.006_694_379_990_14;

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

// Geodesic circle ring via the spherical destination formula, using the
// ellipsoid's Gaussian radius at the center latitude so the ring tracks
// EllipseGraphics' ellipsoidal edge closely (error ~0.05% of the radius).
function circleOutlinePositions(state: CircleState): Cartesian3[] {
  const latRad = (state.center.latitude * Math.PI) / 180;
  const lonRad = (state.center.longitude * Math.PI) / 180;
  const sinLatSq = Math.sin(latRad) ** 2;
  const normalRadius = WGS84_SEMI_MAJOR_M / Math.sqrt(1 - WGS84_E2 * sinLatSq);
  const meridionalRadius = (WGS84_SEMI_MAJOR_M * (1 - WGS84_E2)) / (1 - WGS84_E2 * sinLatSq) ** 1.5;
  const gaussianRadius = Math.sqrt(normalRadius * meridionalRadius);

  const angular = state.radiusMeters / gaussianRadius;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinAng = Math.sin(angular);
  const cosAng = Math.cos(angular);

  const positions: Cartesian3[] = [];
  for (let i = 0; i <= CIRCLE_OUTLINE_SEGMENTS; i++) {
    const bearing = (i / CIRCLE_OUTLINE_SEGMENTS) * 2 * Math.PI;
    const pointLat = Math.asin(sinLat * cosAng + cosLat * sinAng * Math.cos(bearing));
    const pointLon = lonRad + Math.atan2(
      Math.sin(bearing) * sinAng * cosLat,
      cosAng - sinLat * Math.sin(pointLat),
    );
    positions.push(Cartesian3.fromRadians(pointLon, pointLat, 0));
  }
  return positions;
}
