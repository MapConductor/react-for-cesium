import {
  AbstractMarkerController,
  MarkerManager,
  type GeoPoint,
  type MarkerAnimationOverlayHost,
  type MarkerEntity,
  type MarkerState,
  type OnMarkerEventHandler,
} from '@mapconductor/js-sdk-core';
import type { Entity } from 'cesium';
import { CesiumMarkerRenderer } from './CesiumMarkerRenderer';

export class CesiumMarkerController extends AbstractMarkerController<Entity> {
  declare readonly renderer: CesiumMarkerRenderer;

  constructor(renderer: CesiumMarkerRenderer) {
    super({ markerManager: MarkerManager.defaultManager<Entity>(), renderer });
  }
  async composition(data: MarkerState[]): Promise<void> { await this.add(data); }
  has(state: MarkerState): boolean { return this.markerManager.hasEntity(state.id); }
  override find(position: GeoPoint): MarkerEntity<Entity> | null { return this.markerManager.findNearest(position); }
  setOnClickListener(value: OnMarkerEventHandler | null): void { this.clickListener = value; }
  setOnDragStart(value: OnMarkerEventHandler | null): void { this.dragStartListener = value; }
  setOnDrag(value: OnMarkerEventHandler | null): void { this.dragListener = value; }
  setOnDragEnd(value: OnMarkerEventHandler | null): void { this.dragEndListener = value; }
  setOnAnimateStart(value: OnMarkerEventHandler | null): void { this.animateStartListener = value; }
  setOnAnimateEnd(value: OnMarkerEventHandler | null): void { this.animateEndListener = value; }
  setMarkerAnimationOverlayHost(host: MarkerAnimationOverlayHost | null): void { this.renderer.animationOverlayHost = host; }
  updatePosition(state: MarkerState): void {
    const entity = this.markerManager.getEntity(state.id);
    if (entity) this.renderer.setMarkerPosition(entity, state.position);
  }
}
