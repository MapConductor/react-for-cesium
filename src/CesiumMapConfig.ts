import { Viewer } from 'cesium';
import type { GeoRectBounds, MapConfig, MarkerTilingOptions, PolylineTilingOptions, CircleTilingOptions } from '@mapconductor/js-sdk-core';
import type { CesiumMapDesignType } from './CesiumDesign';

export interface CesiumConfig extends MapConfig {
  mapDesignType: CesiumMapDesignType;
  options?: NonNullable<ConstructorParameters<typeof Viewer>[1]>;
  markerTilingOptions?: MarkerTilingOptions;
  /**
   * When to draw polylines as raster tiles; {@link PolylineTilingOptions.Default} if omitted.
   * The controller's `setPolylineTilingOptions` replaces it later.
   */
  polylineTilingOptions?: PolylineTilingOptions;
  /**
   * When to draw circles as raster tiles; {@link CircleTilingOptions.Default} if omitted.
   * The controller's `setCircleTilingOptions` replaces it later.
   */
  circleTilingOptions?: CircleTilingOptions;
  minZoom?: number;
  maxZoom?: number;
  /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
  restrictBounds?: GeoRectBounds;
}
