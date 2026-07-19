import { BillboardGraphics, Cartesian2, Color, ConstantPositionProperty, Entity, PointGraphics } from 'cesium';
import {
  type AddParams,
  AbstractMarkerOverlayRenderer,
  type ChangeParams,
  type MarkerEntity,
  type MarkerState,
} from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from '../CesiumMapViewHolder';
import { toCartesian3 } from '../helpers';
import type { CesiumMarkerRendererInterface } from './CesiumMarkerRendererInterface';
import { cesiumEntityId } from '../entityId';

export class CesiumMarkerRenderer extends AbstractMarkerOverlayRenderer<CesiumMapViewHolder, Entity> implements CesiumMarkerRendererInterface {
  constructor(holder: CesiumMapViewHolder) { super({ holder }); this.supportsAnimationOverlay = true; }

  async onAdd(data: AddParams[]): Promise<(Entity | null)[]> {
    if (this.holder.isDestroyed()) return data.map(() => null);
    return data.map(item => this.holder.map.entities.add(this.createEntity(item.state, item.bitmapIcon)));
  }

  async onChange(data: ChangeParams<Entity>[]): Promise<(Entity | null)[]> {
    if (this.holder.isDestroyed()) return data.map(() => null);
    return data.map(item => {
      const entity = item.prev.marker;
      if (!entity) return this.holder.map.entities.add(this.createEntity(item.current.state, item.bitmapIcon));
      this.apply(entity, item.current.state, item.bitmapIcon);
      return entity;
    });
  }

  async onRemove(data: MarkerEntity<Entity>[]): Promise<void> {
    if (this.holder.isDestroyed()) return;
    data.forEach(item => { if (item.marker) this.holder.map.entities.remove(item.marker); });
  }

  async onPostProcess(): Promise<void> { if (!this.holder.isDestroyed()) this.holder.map.scene.requestRender(); }
  setMarkerVisible(entity: MarkerEntity<Entity>, visible: boolean): void { if (entity.marker) entity.marker.show = visible; }
  setMarkerPosition(entity: MarkerEntity<Entity>, position: MarkerState['position']): void {
    if (entity.marker) entity.marker.position = new ConstantPositionProperty(toCartesian3(position));
  }

  private createEntity(state: MarkerState, bitmap: AddParams['bitmapIcon']): Entity {
    const entity = new Entity({ id: cesiumEntityId('marker', state.id) });
    this.apply(entity, state, bitmap);
    return entity;
  }

  private apply(entity: Entity, state: MarkerState, bitmap: AddParams['bitmapIcon']): void {
    entity.position = new ConstantPositionProperty(toCartesian3(state.position));
    entity.billboard = new BillboardGraphics({
      image: bitmap.url,
      width: bitmap.size.width,
      height: bitmap.size.height,
      pixelOffset: new Cartesian2(bitmap.size.width * (0.5 - bitmap.anchor.x), bitmap.size.height * (0.5 - bitmap.anchor.y)),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    if (!bitmap.url) {
      entity.billboard = undefined;
      entity.point = new PointGraphics({ pixelSize: 12, color: Color.RED, outlineColor: Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY });
    } else {
      entity.point = undefined;
    }
  }
}
