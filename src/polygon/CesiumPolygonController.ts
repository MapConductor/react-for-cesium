import { PolygonController, PolygonManager } from '@mapconductor/js-sdk-core';
import type { Entity } from 'cesium';
import { CesiumPolygonOverlayRenderer } from './CesiumPolygonOverlayRenderer';

export class CesiumPolygonController extends PolygonController<Entity> {
  declare readonly renderer: CesiumPolygonOverlayRenderer;
  constructor(renderer: CesiumPolygonOverlayRenderer) { super({ polygonManager: new PolygonManager<Entity>(), renderer }); }
}
