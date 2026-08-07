import { RasterLayerController, RasterLayerManager, type RasterLayerState , type RasterHeaderSupport } from '@mapconductor/js-sdk-core';
import type { ImageryLayer } from 'cesium';
import { CesiumRasterLayerOverlayRenderer } from './CesiumRasterLayerOverlayRenderer';

export class CesiumRasterLayerController extends RasterLayerController<ImageryLayer> {
  /**
   * headers を持つ Resource を UrlTemplateImageryProvider に渡す。
   *
   * userAgent はブラウザが上書きを許さないので、どのプロバイダでも web では効かない。
   */
  protected override get headerSupport(): RasterHeaderSupport {
    return { provider: 'Cesium', extraHeaders: true };
  }

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
