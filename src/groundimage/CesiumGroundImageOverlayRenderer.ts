import { Color, Entity, ImageMaterialProperty, Rectangle, RectangleGraphics } from 'cesium';
import { type GroundImageAddParams, type GroundImageChangeParams, type GroundImageEntity, type GroundImageOverlayRenderer, type GroundImageState } from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from '../CesiumMapViewHolder';
import { cesiumEntityId } from '../entityId';

export class CesiumGroundImageOverlayRenderer implements GroundImageOverlayRenderer<Entity> {
  constructor(readonly holder: CesiumMapViewHolder) {}
  async onAdd(data: GroundImageAddParams[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ state }) => this.create(state)); }
  async onChange(data: GroundImageChangeParams<Entity>[]): Promise<(Entity | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ current, prev }) => { this.apply(prev.groundImage, current.state); return prev.groundImage; }); }
  async onRemove(data: GroundImageEntity<Entity>[]): Promise<void> { if (!this.holder.isDestroyed()) data.forEach(item => this.holder.map.entities.remove(item.groundImage)); }
  async onPostProcess(): Promise<void> { if (!this.holder.isDestroyed()) this.holder.map.scene.requestRender(); }
  private create(state: GroundImageState): Entity | null {
    if (!state.bounds.southWest || !state.bounds.northEast) return null;
    const entity = this.holder.map.entities.add(new Entity({ id: cesiumEntityId('ground-image', state.id) })); this.apply(entity, state); return entity;
  }
  private apply(entity: Entity, state: GroundImageState): void {
    const sw = state.bounds.southWest; const ne = state.bounds.northEast;
    if (!sw || !ne) { entity.rectangle = undefined; return; }
    entity.rectangle = new RectangleGraphics({
      coordinates: Rectangle.fromDegrees(sw.longitude, sw.latitude, ne.longitude, ne.latitude),
      material: new ImageMaterialProperty({ image: state.imageUrl, color: Color.WHITE.withAlpha(state.opacity) }),
      height: 0,
    });
  }
}
