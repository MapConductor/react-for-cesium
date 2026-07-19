import { PolygonController, PolygonManager, type OnPolygonEventHandler, type PolygonState } from '@mapconductor/js-sdk-core';
import type { Entity } from 'cesium';
import { CesiumPolygonOverlayRenderer } from './CesiumPolygonOverlayRenderer';

export class CesiumPolygonController extends PolygonController<Entity> {
  declare readonly renderer: CesiumPolygonOverlayRenderer;
  constructor(renderer: CesiumPolygonOverlayRenderer) { super({ polygonManager: new PolygonManager<Entity>(), renderer }); }
  async composition(data: PolygonState[]): Promise<void> { await this.add(data); }
  has(state: PolygonState): boolean { return this.polygonManager.hasEntity(state.id); }
  setOnClickListener(value: OnPolygonEventHandler | null): void { this.clickListener = value; }
}
