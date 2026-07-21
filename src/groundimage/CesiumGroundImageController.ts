import { GroundImageController, GroundImageManager } from '@mapconductor/js-sdk-core';
import type { Entity } from 'cesium';
import { CesiumGroundImageOverlayRenderer } from './CesiumGroundImageOverlayRenderer';

export class CesiumGroundImageController extends GroundImageController<Entity> {
  declare readonly renderer: CesiumGroundImageOverlayRenderer;
  constructor(renderer: CesiumGroundImageOverlayRenderer) { super({ groundImageManager: new GroundImageManager<Entity>(), renderer }); }
}
