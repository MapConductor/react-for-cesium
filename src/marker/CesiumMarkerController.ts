import {
  AbstractMarkerController,
  MarkerManager,
  type MarkerState,
} from '@mapconductor/js-sdk-core';
import type { Entity } from 'cesium';
import { CesiumMarkerRenderer } from './CesiumMarkerRenderer';

export class CesiumMarkerController extends AbstractMarkerController<Entity> {
  declare readonly renderer: CesiumMarkerRenderer;

  constructor(renderer: CesiumMarkerRenderer) {
    super({ markerManager: MarkerManager.defaultManager<Entity>(), renderer });
  }
  updatePosition(state: MarkerState): void {
    const entity = this.markerManager.getEntity(state.id);
    if (entity) this.renderer.setMarkerPosition(entity, state.position);
  }
}
