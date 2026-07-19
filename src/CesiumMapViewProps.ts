import { Viewer } from 'cesium';
import type { CSSProperties, ReactNode } from 'react';
import type { MapViewBaseProps, MarkerTilingOptions } from '@mapconductor/js-sdk-core';
import type { CesiumMapViewStateInterface } from './CesiumMapViewState';

export interface CesiumMapViewProps extends MapViewBaseProps<CesiumMapViewStateInterface> {
  className?: string;
  containerStyle?: CSSProperties;
  options?: NonNullable<ConstructorParameters<typeof Viewer>[1]>;
  onError?: (error: Error) => void;
  children?: ReactNode;
  markerTilingOptions?: MarkerTilingOptions;
}
