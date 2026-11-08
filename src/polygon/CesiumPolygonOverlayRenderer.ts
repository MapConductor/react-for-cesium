import { ArcType, Cartesian3, Entity, PolygonGraphics, PolygonHierarchy, PolylineGraphics } from 'cesium';
import { densifyPolygonRing, resolveHoles, type GeoPoint, type PolygonAddParams, type PolygonChangeParams, type PolygonEntity, type PolygonOverlayRenderer, type PolygonState } from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from '../CesiumMapViewHolder';
import { toCesiumColor } from '../color';
import { pointsToDegrees } from '../helpers';
import { cesiumEntityId } from '../entityId';
import { groundZIndex } from '../zOrder';

// Same segment length react-for-arcgis uses for polygons: coarser than
// polylines so world-scale rings don't densify into huge geometries.
const GEODESIC_MAX_SEGMENT_LENGTH_METERS = 100_000;
// Planar.createInterpolatePoints' default, the same as polylines use.
const LINEAR_MAX_SEGMENT_LENGTH_METERS = 10_000;

export class CesiumPolygonOverlayRenderer implements PolygonOverlayRenderer<Entity> {
  constructor(readonly holder: CesiumMapViewHolder) {}
  async onAdd(data: PolygonAddParams[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ state }) => this.create(state)); }
  async onChange(data: PolygonChangeParams<Entity>[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ current, prev }) => { this.apply(prev.polygon, current.state); return prev.polygon; }); }
  async onRemove(data: PolygonEntity<Entity>[]): Promise<void> { if (!this.holder.isDestroyed()) data.forEach(item => this.holder.map.entities.remove(item.polygon)); }
  async onPostProcess(): Promise<void> { if (!this.holder.isDestroyed()) this.holder.map.scene.requestRender(); }
  private create(state: PolygonState): Entity { const entity = this.holder.map.entities.add(new Entity({ id: cesiumEntityId('polygon', state.id) })); this.apply(entity, state); return entity; }
  private apply(entity: Entity, inputState: PolygonState): void {
    // Overlapping holes are merged here, at geometry build time, the same place
    // the Android renderers call resolveHoles(). The component-level union in
    // Polygon.tsx does not re-run when state.holes is swapped at runtime.
    const state = resolveHoles(inputState);
    // Cesium always connects polygon vertices with geodesic arcs, so a
    // geodesic:false polygon would take the exact same shape as a geodesic
    // one. Densify each ring ourselves — great-circle interpolation when
    // geodesic, linear lon/lat interpolation (Google Maps' straight-line
    // semantics) otherwise — so the two modes produce their intended shapes.
    // Each ring includes its closing edge (last vertex -> first) in both
    // modes: interpolating only between neighbours leaves that edge one long
    // rhumb segment in the fill while the outline curved along it.
    const densify = (points: GeoPoint[]): GeoPoint[] =>
      densifyPolygonRing(
        points,
        state.geodesic,
        state.geodesic ? GEODESIC_MAX_SEGMENT_LENGTH_METERS : LINEAR_MAX_SEGMENT_LENGTH_METERS,
      );

    // No height: the polygon renders as ground geometry, which is what makes
    // Cesium honour zIndex ordering against other overlays (polylines sit in
    // a higher band; see zOrder.ts). Ground polygons cannot draw their own
    // outline — and geometry outlines are 1px-capped by WebGL anyway — so the
    // stroke is a clamped polyline ring over the outer boundary instead
    // (hole boundaries are not stroked).
    const outer = densify(state.points);
    entity.polygon = new PolygonGraphics({
      hierarchy: new PolygonHierarchy(
        Cartesian3.fromDegreesArray(pointsToDegrees(outer)),
        state.holes.map(hole => new PolygonHierarchy(Cartesian3.fromDegreesArray(pointsToDegrees(densify(hole))))),
      ),
      material: toCesiumColor(state.fillColor),
      // No height: zIndex is only honoured for ground geometry ("Entity
      // geometry with zIndex are unsupported when height or extrudedHeight
      // are defined"). RHUMB subdivides in cartographic (lon/lat) space,
      // matching the densified lon/lat rings; the default GEODESIC
      // triangulation breaks down on very large rings. Note Cesium cannot
      // render rings approaching hemisphere size (world-mask polygons render
      // inverted or disappear) — keep mask polygons regional.
      arcType: ArcType.RHUMB,
      zIndex: groundZIndex('polygon', state.zIndex),
    });
    entity.polyline = state.strokeWidth > 0
      ? new PolylineGraphics({
          positions: closedRingPositions(outer),
          width: state.strokeWidth,
          material: toCesiumColor(state.strokeColor),
          clampToGround: true,
          // Same arc type as the fill: between the densified vertices both
          // fill and outline take the rhumb (lon/lat) segment, so they trace
          // one line. With GEODESIC the outline bowed away from the fill on
          // every segment, most visibly on long undensified ones.
          arcType: ArcType.RHUMB,
          zIndex: groundZIndex('polygon', state.zIndex),
        })
      : undefined;
  }
}

function closedRingPositions(ring: GeoPoint[]): Cartesian3[] {
  const degrees = pointsToDegrees(ring);
  if (degrees.length >= 2) {
    const firstLon = degrees[0];
    const firstLat = degrees[1];
    const lastLon = degrees[degrees.length - 2];
    const lastLat = degrees[degrees.length - 1];
    if (firstLon !== lastLon || firstLat !== lastLat) degrees.push(firstLon, firstLat);
  }
  return Cartesian3.fromDegreesArray(degrees);
}
