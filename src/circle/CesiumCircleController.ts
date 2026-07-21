import { CircleController, CircleManager } from '@mapconductor/js-sdk-core';
import type { Entity } from 'cesium';
import { CesiumCircleOverlayRenderer } from './CesiumCircleOverlayRenderer';

export class CesiumCircleController extends CircleController<Entity> {
  declare readonly renderer: CesiumCircleOverlayRenderer;
  constructor(renderer: CesiumCircleOverlayRenderer) { super({ circleManager: new CircleManager<Entity>(), renderer }); }
}
