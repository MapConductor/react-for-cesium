import { Cartesian3, Entity, PolygonGraphics, PolygonHierarchy } from 'cesium';
import { type PolygonAddParams, type PolygonChangeParams, type PolygonEntity, type PolygonOverlayRenderer, type PolygonState } from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from '../CesiumMapViewHolder';
import { toCesiumColor } from '../color';
import { pointsToDegrees } from '../helpers';
import { cesiumEntityId } from '../entityId';

export class CesiumPolygonOverlayRenderer implements PolygonOverlayRenderer<Entity> {
  constructor(readonly holder: CesiumMapViewHolder) {}
  async onAdd(data: PolygonAddParams[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ state }) => this.create(state)); }
  async onChange(data: PolygonChangeParams<Entity>[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ current, prev }) => { this.apply(prev.polygon, current.state); return prev.polygon; }); }
  async onRemove(data: PolygonEntity<Entity>[]): Promise<void> { if (!this.holder.isDestroyed()) data.forEach(item => this.holder.map.entities.remove(item.polygon)); }
  async onPostProcess(): Promise<void> { if (!this.holder.isDestroyed()) this.holder.map.scene.requestRender(); }
  private create(state: PolygonState): Entity { const entity = this.holder.map.entities.add(new Entity({ id: cesiumEntityId('polygon', state.id) })); this.apply(entity, state); return entity; }
  private apply(entity: Entity, state: PolygonState): void {
    entity.polygon = new PolygonGraphics({
      hierarchy: new PolygonHierarchy(
        Cartesian3.fromDegreesArray(pointsToDegrees(state.points)),
        state.holes.map(hole => new PolygonHierarchy(Cartesian3.fromDegreesArray(pointsToDegrees(hole)))),
      ),
      material: toCesiumColor(state.fillColor), outline: state.strokeWidth > 0, outlineColor: toCesiumColor(state.strokeColor), height: 0,
    });
  }
}
