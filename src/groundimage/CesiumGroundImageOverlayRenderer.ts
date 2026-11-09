import { Color, Entity, ImageMaterialProperty, Rectangle, RectangleGraphics } from 'cesium';
import { type GroundImageAddParams, type GroundImageChangeParams, type GroundImageEntity, type GroundImageOverlayRenderer, type GroundImageState } from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from '../CesiumMapViewHolder';
import { cesiumEntityId } from '../entityId';
import { groundZIndex } from '../zOrder';

export class CesiumGroundImageOverlayRenderer implements GroundImageOverlayRenderer<Entity> {
  constructor(readonly holder: CesiumMapViewHolder) { }
  async onAdd(data: GroundImageAddParams[]): Promise<(Entity | null)[]> {
    return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ state }) => this.create(state));
  }
  async onChange(data: GroundImageChangeParams<Entity>[]): Promise<(Entity | null)[]> {
    return this.holder.isDestroyed() ? data.map(() => null) : data.map(({ current, prev }) => {
      this.apply(prev.groundImage, current.state);
      return prev.groundImage;
    });
  }
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
      // transparent: true makes Cesium honor the image's own alpha channel.
      // It defaults to false, which treats the PNG as fully opaque and ignores
      // transparent pixels; `color`'s alpha only scales the overall opacity, not
      // the per-pixel alpha, so both are needed.
      material: new ImageMaterialProperty({ image: state.imageUrl, color: Color.WHITE.withAlpha(state.opacity), transparent: true }),
      // Ground geometry (no height) so Cesium orders it by zIndex with the polygons, circles and
      // polylines: under them, in the ground-image band. With `height: 0` it was an ordinary
      // primitive drawn after every ground primitive, i.e. over the polygons.
      zIndex: groundZIndex('groundImage', 0),
    });
  }
}
