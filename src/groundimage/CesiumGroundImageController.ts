import { GroundImageController, GroundImageManager, type GroundImageState, type OnGroundImageEventHandler } from '@mapconductor/js-sdk-core';
import type { Entity } from 'cesium';
import { CesiumGroundImageOverlayRenderer } from './CesiumGroundImageOverlayRenderer';

export class CesiumGroundImageController extends GroundImageController<Entity> {
  declare readonly renderer: CesiumGroundImageOverlayRenderer;
  constructor(renderer: CesiumGroundImageOverlayRenderer) { super({ groundImageManager: new GroundImageManager<Entity>(), renderer }); }
  async composition(data: GroundImageState[]): Promise<void> { await this.add(data); }
  has(state: GroundImageState): boolean { return this.groundImageManager.hasEntity(state.id); }
  setOnClickListener(value: OnGroundImageEventHandler | null): void { this.clickListener = value; }
}
