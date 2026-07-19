import { ArcGisMapServerImageryProvider, ImageryLayer, TileMapServiceImageryProvider, UrlTemplateImageryProvider, WebMercatorTilingScheme } from 'cesium';
import { type MapCameraPosition, type RasterLayerAddParams, type RasterLayerChangeParams, type RasterLayerEntity, type RasterLayerOverlayRenderer, type RasterLayerState } from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from '../CesiumMapViewHolder';

export class CesiumRasterLayerOverlayRenderer implements RasterLayerOverlayRenderer<ImageryLayer> {
  private readonly zIndexes = new Map<ImageryLayer, number>();
  constructor(readonly holder: CesiumMapViewHolder) {}
  async onAdd(data: RasterLayerAddParams[]): Promise<(ImageryLayer | null)[]> { return this.holder.isDestroyed() ? data.map(() => null) : Promise.all(data.map(({ state }) => state.visible ? this.create(state) : null)); }
  async onChange(data: RasterLayerChangeParams<ImageryLayer>[]): Promise<(ImageryLayer | null)[]> {
    if (this.holder.isDestroyed()) return data.map(() => null);
    return Promise.all(data.map(async ({ current, prev }) => { this.holder.map.imageryLayers.remove(prev.layer, true); return current.state.visible ? this.create(current.state) : null; }));
  }
  async onRemove(data: RasterLayerEntity<ImageryLayer>[]): Promise<void> { if (!this.holder.isDestroyed()) data.forEach(item => { this.zIndexes.delete(item.layer); this.holder.map.imageryLayers.remove(item.layer, true); }); }
  async onCameraChanged(_position: MapCameraPosition): Promise<void> {}
  async onPostProcess(): Promise<void> {
    if (this.holder.isDestroyed()) return;
    [...this.zIndexes.entries()].sort((a, b) => a[1] - b[1]).forEach(([layer]) => this.holder.map.imageryLayers.raiseToTop(layer));
    this.holder.map.scene.requestRender();
  }
  private async create(state: RasterLayerState): Promise<ImageryLayer | null> {
    const source = state.source;
    const provider = source.type === 'UrlTemplate'
      ? new UrlTemplateImageryProvider({
          url: source.scheme === 'TMS' ? source.template.replace(/\{y\}/g, '{reverseY}') : source.template,
          tilingScheme: new WebMercatorTilingScheme(),
          minimumLevel: source.minZoom ?? undefined,
          maximumLevel: source.maxZoom ?? undefined,
        })
      : source.type === 'ArcGisService'
        ? await ArcGisMapServerImageryProvider.fromUrl(source.serviceUrl)
        : await TileMapServiceImageryProvider.fromUrl(source.url);
    if (this.holder.isDestroyed()) return null;
    const layer = new ImageryLayer(provider, { alpha: state.opacity, show: state.visible });
    this.holder.map.imageryLayers.add(layer);
    this.zIndexes.set(layer, state.zIndex);
    return layer;
  }
}
