import { PolylineController, PolylineManager } from '@mapconductor/js-sdk-core';
import type { Entity } from 'cesium';
import { CesiumPolylineOverlayRenderer } from './CesiumPolylineOverlayRenderer';

export class CesiumPolylineController extends PolylineController<Entity> {
  declare readonly renderer: CesiumPolylineOverlayRenderer;
  constructor(renderer: CesiumPolylineOverlayRenderer) { super({ polylineManager: new PolylineManager<Entity>(), renderer }); }
}
