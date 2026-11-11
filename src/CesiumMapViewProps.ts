import { Viewer } from 'cesium';
import type { CSSProperties, ReactNode } from 'react';
import type { GeoRectBounds, MapViewBaseProps, MarkerTilingOptions, PolylineTilingOptions, CircleTilingOptions } from '@mapconductor/js-sdk-core';
import type { CesiumMapViewStateInterface } from './CesiumMapViewState';

export interface CesiumMapViewProps extends MapViewBaseProps<CesiumMapViewStateInterface> {
  className?: string;
  containerStyle?: CSSProperties;
  options?: NonNullable<ConstructorParameters<typeof Viewer>[1]>;
  onError?: (error: Error) => void;
  children?: ReactNode;
  markerTilingOptions?: MarkerTilingOptions;
  /**
   * When to draw polylines as raster tiles ({@link PolylineTilingOptions.Default} if omitted).
   * Read when the map is created; a later value applies from the next time the polylines are
   * handed to the map.
   */
  polylineTilingOptions?: PolylineTilingOptions;
  /**
   * When to draw circles as raster tiles ({@link CircleTilingOptions.Default} if omitted).
   * Read when the map is created; a later value applies from the next time the circles are
   * handed to the map.
   */
  circleTilingOptions?: CircleTilingOptions;
  minZoom?: number;
  maxZoom?: number;
  /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
  restrictBounds?: GeoRectBounds;
}
