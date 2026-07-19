import { Viewer } from 'cesium';
import type { MapConfig, MarkerTilingOptions } from '@mapconductor/js-sdk-core';
import type { CesiumMapDesignType } from './CesiumDesign';

export interface CesiumConfig extends MapConfig {
  mapDesignType: CesiumMapDesignType;
  options?: NonNullable<ConstructorParameters<typeof Viewer>[1]>;
  markerTilingOptions?: MarkerTilingOptions;
}
