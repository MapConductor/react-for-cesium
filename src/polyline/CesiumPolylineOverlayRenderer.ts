import { Entity, PolylineGraphics } from 'cesium';
import { type PolylineAddParams, type PolylineChangeParams, type PolylineEntity, type PolylineOverlayRenderer, type PolylineState } from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from '../CesiumMapViewHolder';
import { toCesiumColor } from '../color';
import { pointsToDegrees } from '../helpers';
import { Cartesian3 } from 'cesium';
import { cesiumEntityId } from '../entityId';

export class CesiumPolylineOverlayRenderer implements PolylineOverlayRenderer<Entity> {
  constructor(readonly holder: CesiumMapViewHolder) {}
  async onAdd(data: PolylineAddParams[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ state }) => this.create(state)); }
  async onChange(data: PolylineChangeParams<Entity>[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ current, prev }) => { this.apply(prev.polyline, current.state); return prev.polyline; }); }
  async onRemove(data: PolylineEntity<Entity>[]): Promise<void> { if (!this.holder.isDestroyed()) data.forEach(item => this.holder.map.entities.remove(item.polyline)); }
  async onPostProcess(): Promise<void> { if (!this.holder.isDestroyed()) this.holder.map.scene.requestRender(); }
  private create(state: PolylineState): Entity { const entity = this.holder.map.entities.add(new Entity({ id: cesiumEntityId('polyline', state.id) })); this.apply(entity, state); return entity; }
  private apply(entity: Entity, state: PolylineState): void { entity.polyline = new PolylineGraphics({ positions: Cartesian3.fromDegreesArray(pointsToDegrees(state.points)), width: state.strokeWidth, material: toCesiumColor(state.strokeColor), clampToGround: true }); }
}
