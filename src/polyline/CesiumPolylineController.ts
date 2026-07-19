import { PolylineController, PolylineManager, type OnPolylineEventHandler, type PolylineState } from '@mapconductor/js-sdk-core';
import type { Entity } from 'cesium';
import { CesiumPolylineOverlayRenderer } from './CesiumPolylineOverlayRenderer';

export class CesiumPolylineController extends PolylineController<Entity> {
  declare readonly renderer: CesiumPolylineOverlayRenderer;
  constructor(renderer: CesiumPolylineOverlayRenderer) { super({ polylineManager: new PolylineManager<Entity>(), renderer }); }
  async composition(data: PolylineState[]): Promise<void> { await this.add(data); }
  has(state: PolylineState): boolean { return this.polylineManager.hasEntity(state.id); }
  setOnClickListener(value: OnPolylineEventHandler | null): void { this.clickListener = value; }
}
