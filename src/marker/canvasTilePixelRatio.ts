import { tilePixelRatio } from '@mapconductor/js-sdk-core';

/** The parts of Cesium's `Viewer` that decide how finely its canvas is drawn. */
export interface CesiumCanvasResolution {
  readonly useBrowserRecommendedResolution: boolean;
  readonly resolutionScale: number;
}

/**
 * The tile ratio for marker tiles on a Cesium globe.
 *
 * Cesium draws its canvas at 1 device pixel per CSS pixel unless the app sets
 * `useBrowserRecommendedResolution: false` (the default is true), then
 * multiplies by `resolutionScale` (see CesiumWidget's configurePixelRatio). A 2x
 * tile on a 1x canvas would only be shrunk again, so the ratio follows the
 * canvas rather than the display.
 */
export function canvasTilePixelRatio(
  viewer: CesiumCanvasResolution,
  devicePixelRatio: number | undefined = typeof globalThis.devicePixelRatio === 'number'
    ? globalThis.devicePixelRatio
    : undefined,
): number {
  const displayRatio = viewer.useBrowserRecommendedResolution ? 1 : (devicePixelRatio ?? 1);
  return tilePixelRatio(displayRatio * viewer.resolutionScale);
}
