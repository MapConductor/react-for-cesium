import { RasterLayerController, RasterLayerManager, type RasterLayerState } from '@mapconductor/js-sdk-core';
import type { ImageryLayer } from 'cesium';
import { CesiumRasterLayerOverlayRenderer } from './CesiumRasterLayerOverlayRenderer';

export class CesiumRasterLayerController extends RasterLayerController<ImageryLayer> {
  declare readonly renderer: CesiumRasterLayerOverlayRenderer;
  constructor(renderer: CesiumRasterLayerOverlayRenderer) { super({ rasterLayerManager: new RasterLayerManager<ImageryLayer>(), renderer }); }
  async composition(data: RasterLayerState[]): Promise<void> {
    await this.add(data);
    data.filter(state => !state.visible).forEach(state => this.rasterLayerManager.removeEntity(state.id));
  }
  override async update(state: RasterLayerState): Promise<void> {
    await super.update(state);
    if (!state.visible) this.rasterLayerManager.removeEntity(state.id);
  }
}
