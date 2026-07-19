import { CircleController, CircleManager, type CircleState, type OnCircleEventHandler } from '@mapconductor/js-sdk-core';
import type { Entity } from 'cesium';
import { CesiumCircleOverlayRenderer } from './CesiumCircleOverlayRenderer';

export class CesiumCircleController extends CircleController<Entity> {
  declare readonly renderer: CesiumCircleOverlayRenderer;
  constructor(renderer: CesiumCircleOverlayRenderer) { super({ circleManager: new CircleManager<Entity>(), renderer }); }
  async composition(data: CircleState[]): Promise<void> { await this.add(data); }
  has(state: CircleState): boolean { return this.circleManager.hasEntity(state.id); }
  setOnClickListener(value: OnCircleEventHandler | null): void { this.clickListener = value; }
}
