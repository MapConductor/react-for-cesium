import { BillboardGraphics, BoundingSphere, Cartesian2, Cartesian3, Color, ConstantPositionProperty, ConstantProperty, Ellipsoid, Entity, Occluder, PointGraphics } from 'cesium';
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
  /** 追従中のマーカー Entity。毎フレームの裏側判定（オクルージョン）で走査する。 */
  private readonly markerEntities = new Set<Entity>();
  /** 直近に適用した「表示可否（裏側でない）」。値が変わったときだけ show を更新するためのキャッシュ。 */
  private readonly occlusionState = new WeakMap<Entity, boolean>();
  /**
   * カメラ位置から見て地球の裏側かどうかを判定するオクルーダー。
   * 地球を「極半径（最小半径）の球」で近似する。極半径にすることで、可視マーカーを誤って
   * 隠すことなく、明確に裏側にある点だけを非表示にする（水平線付近は保守的に可視側へ倒す）。
   */
  private readonly occluder = new Occluder(new BoundingSphere(Cartesian3.ZERO, Ellipsoid.WGS84.minimumRadius), new Cartesian3());
  private readonly scratchPosition = new Cartesian3();

  constructor(holder: CesiumMapViewHolder) {
    super({ holder });
    this.supportsAnimationOverlay = true;
    // マーカーは disableDepthTestDistance=Infinity で常に前面描画されるため、深度テストでは
    // 地球に隠れず、裏側のマーカーも見えてしまう。毎フレーム（preRender）に楕円体オクルーダーで
    // 水平線の向こう＝地球の裏側にある点を判定し、billboard/point の show を切り替えて非表示にする。
    // 論理的な表示/アニメーションは Entity.show 側（setMarkerVisible）で制御され、Cesium は
    // Entity.show と billboard.show を AND するため、両者は競合しない。
    if (!holder.isDestroyed()) {
      holder.map.scene.preRender.addEventListener(this.updateOcclusion);
    }
  }

  async onAdd(data: AddParams[]): Promise<(Entity | null)[]> {
    if (this.holder.isDestroyed()) return data.map(() => null);
    return data.map(item => {
      const entity = this.holder.map.entities.add(this.createEntity(item.state, item.bitmapIcon));
      this.markerEntities.add(entity);
      return entity;
    });
  }

  async onChange(data: ChangeParams<Entity>[]): Promise<(Entity | null)[]> {
    if (this.holder.isDestroyed()) return data.map(() => null);
    return data.map(item => {
      const entity = item.prev.marker;
      if (!entity) {
        const created = this.holder.map.entities.add(this.createEntity(item.current.state, item.bitmapIcon));
        this.markerEntities.add(created);
        return created;
      }
      this.apply(entity, item.current.state, item.bitmapIcon);
      return entity;
    });
  }

  async onRemove(data: MarkerEntity<Entity>[]): Promise<void> {
    if (this.holder.isDestroyed()) return;
    data.forEach(item => {
      if (item.marker) {
        this.holder.map.entities.remove(item.marker);
        this.markerEntities.delete(item.marker);
        this.occlusionState.delete(item.marker);
      }
    });
  }

  async onPostProcess(): Promise<void> { if (!this.holder.isDestroyed()) this.holder.map.scene.requestRender(); }
  setMarkerVisible(entity: MarkerEntity<Entity>, visible: boolean): void { if (entity.marker) entity.marker.show = visible; }
  setMarkerPosition(entity: MarkerEntity<Entity>, position: MarkerState['position']): void {
    if (entity.marker) entity.marker.position = new ConstantPositionProperty(toCartesian3(position));
  }

  /**
   * 地球の裏側（カメラから見て水平線の向こう）にあるマーカーを非表示にする。
   * `preRender` で毎フレーム呼ばれるので、fly-to 等のカメラ移動にも追従する。
   */
  private readonly updateOcclusion = (): void => {
    if (this.holder.isDestroyed() || this.markerEntities.size === 0) return;
    const scene = this.holder.map.scene;
    this.occluder.cameraPosition = scene.camera.positionWC;
    const time = this.holder.map.clock.currentTime;
    for (const entity of this.markerEntities) {
      const position = entity.position?.getValue(time, this.scratchPosition);
      if (!position) continue;
      const visible = this.occluder.isPointVisible(position);
      if (this.occlusionState.get(entity) === visible) continue;
      this.occlusionState.set(entity, visible);
      const show = new ConstantProperty(visible);
      if (entity.billboard) entity.billboard.show = show;
      if (entity.point) entity.point.show = show;
    }
  };

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
    // 位置やアイコンが変わったら、次フレームで裏側判定をやり直す。
    this.occlusionState.delete(entity);
  }
}
