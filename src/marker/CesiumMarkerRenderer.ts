import { Billboard, BillboardCollection, BoundingSphere, Cartesian2, Cartesian3, Color, ConstantPositionProperty, ConstantProperty, Ellipsoid, Entity, Occluder, PointGraphics } from 'cesium';
import {
  type AddParams,
  AbstractMarkerOverlayRenderer,
  type ChangeParams,
  type MarkerEntity,
  type MarkerState,
  markerDrawOrder,
} from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from '../CesiumMapViewHolder';
import { toCartesian3 } from '../helpers';
import type { CesiumMarkerRendererInterface } from './CesiumMarkerRendererInterface';
import { cesiumEntityId } from '../entityId';

/** What a marker's billboard is built from; kept so the collection can be rebuilt in order. */
interface BillboardSpec {
  position: Cartesian3;
  image: string;
  width: number;
  height: number;
  pixelOffset: Cartesian2;
  order: number;
}

// マーカーは自前の BillboardCollection に描く。
//
// 深度テストを切った billboard（disableDepthTestDistance=Infinity）はどれも near 面に置かれ、
// 深度が等しいので**先に描いたものが残る**（コレクションの前ほど手前）。Entity の billboard は
// プール済みの番号を使い回すので並びを制御できず、同じ地点では先に足したマーカーが手前に
// 出ていた。ここでは共通の重なり順（zIndex、同じなら南、緯度も同じなら西が手前。
// markerDrawOrder）の**逆順**に並べ直す。
//
// マーカーの Entity は地図の entities には入れず、マーカーの手綱（位置・表示・id）としてだけ
// 持つ。billboard の id にその Entity を入れるので、`scene.pick` は今までどおり Entity を返す。
// アイコンの無いマーカー（赤い点）だけは従来どおり Entity の point で描く。
export class CesiumMarkerRenderer extends AbstractMarkerOverlayRenderer<CesiumMapViewHolder, Entity> implements CesiumMarkerRendererInterface {
  /** 追従中のマーカー Entity。毎フレームの裏側判定（オクルージョン）で走査する。 */
  private readonly markerEntities = new Set<Entity>();
  /** 直近に適用した「表示可否（裏側でない）」。値が変わったときだけ show を更新するためのキャッシュ。 */
  private readonly occlusionState = new WeakMap<Entity, boolean>();
  /** @internal */
  private readonly billboards: BillboardCollection | null;
  /** @internal */
  private readonly specs = new Map<Entity, BillboardSpec>();
  /** @internal */
  private readonly billboardOf = new Map<Entity, Billboard>();
  /** 並びが崩れているかもしれない（追加・順の変化）。onPostProcess / preRender で並べ直す。 @internal */
  private orderDirty = false;
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
    // 論理的な表示/アニメーションは Entity.show 側（setMarkerVisible）で制御し、billboard の
    // show には両者の AND を入れる。
    if (!holder.isDestroyed()) {
      this.billboards = holder.map.scene.primitives.add(new BillboardCollection({ scene: holder.map.scene }));
      holder.map.scene.preRender.addEventListener(this.updateOcclusion);
    } else {
      this.billboards = null;
    }
  }

  async onAdd(data: AddParams[]): Promise<(Entity | null)[]> {
    if (this.holder.isDestroyed()) return data.map(() => null);
    return data.map(item => {
      const entity = this.createEntity(item.state, item.bitmapIcon);
      this.markerEntities.add(entity);
      return entity;
    });
  }

  async onChange(data: ChangeParams<Entity>[]): Promise<(Entity | null)[]> {
    if (this.holder.isDestroyed()) return data.map(() => null);
    return data.map(item => {
      const entity = item.prev.marker;
      if (!entity) {
        const created = this.createEntity(item.current.state, item.bitmapIcon);
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
        this.removeBillboard(item.marker);
        if (item.marker.point) this.holder.map.entities.remove(item.marker);
        this.markerEntities.delete(item.marker);
        this.occlusionState.delete(item.marker);
      }
    });
  }

  async onPostProcess(): Promise<void> {
    if (this.holder.isDestroyed()) return;
    if (this.orderDirty) this.rebuildInOrder();
    this.holder.map.scene.requestRender();
  }

  setMarkerVisible(entity: MarkerEntity<Entity>, visible: boolean): void {
    if (!entity.marker) return;
    entity.marker.show = visible;
    this.syncShow(entity.marker);
  }

  setMarkerPosition(entity: MarkerEntity<Entity>, position: MarkerState['position']): void {
    const marker = entity.marker;
    if (!marker) return;
    const cartesian = toCartesian3(position);
    marker.position = new ConstantPositionProperty(cartesian);
    const spec = this.specs.get(marker);
    if (spec) {
      spec.position = cartesian;
      const billboard = this.billboardOf.get(marker);
      if (billboard) billboard.position = cartesian;
      const order = markerDrawOrder(entity.state.zIndex, position);
      if (order !== spec.order) {
        spec.order = order;
        this.orderDirty = true;
      }
    }
    this.occlusionState.delete(marker);
  }

  /**
   * 地球の裏側（カメラから見て水平線の向こう）にあるマーカーを非表示にする。
   * `preRender` で毎フレーム呼ばれるので、fly-to 等のカメラ移動にも追従する。
   */
  private readonly updateOcclusion = (): void => {
    if (this.holder.isDestroyed()) return;
    // 並び直しがまだなら、ここでも済ませる（ドラッグ中は onPostProcess が来ない）。
    if (this.orderDirty) this.rebuildInOrder();
    if (this.markerEntities.size === 0) return;
    const scene = this.holder.map.scene;
    this.occluder.cameraPosition = scene.camera.positionWC;
    const time = this.holder.map.clock.currentTime;
    for (const entity of this.markerEntities) {
      const position = entity.position?.getValue(time, this.scratchPosition);
      if (!position) continue;
      const visible = this.occluder.isPointVisible(position);
      if (this.occlusionState.get(entity) === visible) continue;
      this.occlusionState.set(entity, visible);
      this.syncShow(entity);
    }
  };

  private createEntity(state: MarkerState, bitmap: AddParams['bitmapIcon']): Entity {
    const entity = new Entity({ id: cesiumEntityId('marker', state.id) });
    this.apply(entity, state, bitmap);
    return entity;
  }

  /** 論理的な表示（Entity.show）と裏側判定の AND を、billboard / point に入れる。 @internal */
  private syncShow(entity: Entity): void {
    const show = entity.show && this.occlusionState.get(entity) !== false;
    const billboard = this.billboardOf.get(entity);
    if (billboard) billboard.show = show;
    if (entity.point) entity.point.show = new ConstantProperty(show);
  }

  private apply(entity: Entity, state: MarkerState, bitmap: AddParams['bitmapIcon']): void {
    const position = toCartesian3(state.position);
    entity.position = new ConstantPositionProperty(position);
    if (!bitmap.url) {
      this.removeBillboard(entity);
      entity.point = new PointGraphics({ pixelSize: 12, color: Color.RED, outlineColor: Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY });
      if (!this.holder.map.entities.contains(entity)) this.holder.map.entities.add(entity);
    } else {
      if (entity.point) {
        entity.point = undefined;
        this.holder.map.entities.remove(entity);
      }
      const spec: BillboardSpec = {
        position,
        image: bitmap.url,
        width: bitmap.size.width,
        height: bitmap.size.height,
        pixelOffset: new Cartesian2(bitmap.size.width * (0.5 - bitmap.anchor.x), bitmap.size.height * (0.5 - bitmap.anchor.y)),
        order: markerDrawOrder(state.zIndex, state.position),
      };
      const previous = this.specs.get(entity);
      this.specs.set(entity, spec);
      const billboard = this.billboardOf.get(entity);
      if (billboard) {
        billboard.position = spec.position;
        billboard.image = spec.image;
        billboard.width = spec.width;
        billboard.height = spec.height;
        billboard.pixelOffset = spec.pixelOffset;
        if (previous?.order !== spec.order) this.orderDirty = true;
      } else {
        this.addBillboard(entity, spec);
        this.orderDirty = true;
      }
    }
    // 位置やアイコンが変わったら、次フレームで裏側判定をやり直す。
    this.occlusionState.delete(entity);
    this.syncShow(entity);
  }

  /** @internal */
  private addBillboard(entity: Entity, spec: BillboardSpec): void {
    if (!this.billboards) return;
    const billboard = this.billboards.add({
      position: spec.position,
      image: spec.image,
      width: spec.width,
      height: spec.height,
      pixelOffset: spec.pixelOffset,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      id: entity,
    });
    this.billboardOf.set(entity, billboard);
  }

  /** @internal */
  private removeBillboard(entity: Entity): void {
    const billboard = this.billboardOf.get(entity);
    if (billboard && this.billboards && !this.billboards.isDestroyed()) this.billboards.remove(billboard);
    this.billboardOf.delete(entity);
    this.specs.delete(entity);
  }

  /**
   * コレクションを手前のものから順に作り直す（前ほど手前。クラスの説明を参照）。
   * 順がすでに合っていれば何もしない。
   * @internal
   */
  private rebuildInOrder(): void {
    this.orderDirty = false;
    const collection = this.billboards;
    if (!collection || collection.isDestroyed()) return;
    const entries = [...this.specs.entries()].sort((a, b) => b[1].order - a[1].order);
    const current: Entity[] = [];
    for (let i = 0; i < collection.length; i++) current.push(collection.get(i).id as Entity);
    if (current.length === entries.length && entries.every(([entity], index) => current[index] === entity)) return;
    collection.removeAll();
    this.billboardOf.clear();
    for (const [entity, spec] of entries) {
      this.addBillboard(entity, spec);
      this.syncShow(entity);
    }
  }
}
