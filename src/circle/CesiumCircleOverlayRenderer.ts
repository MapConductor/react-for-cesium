import { ConstantPositionProperty, EllipseGraphics, Entity } from 'cesium';
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
    entity.ellipse = new EllipseGraphics({ semiMajorAxis: state.radiusMeters, semiMinorAxis: state.radiusMeters, material: toCesiumColor(state.fillColor), outline: state.strokeWidth > 0, outlineColor: toCesiumColor(state.strokeColor), height: 0 });
  }
}
