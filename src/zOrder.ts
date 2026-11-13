import { overlayStackZ } from '@mapconductor/js-sdk-core';

// Cesium orders ground geometry (entities without height / with clampToGround) by their
// zIndex property. Each overlay kind gets its own band from the shared stack
// (js-sdk-core OVERLAY_STACK_ORDER: raster < ground image < polygon < circle < polyline <
// marker), with the per-state zIndex inside it (clamped to ±499 so it cannot cross a band).
//
// Circles used to share the polygons' band (3000), so which one was on top depended on the
// order they were added in.
//
// Rasters are imagery layers and markers are billboards; Cesium draws imagery under every
// ground primitive and billboards over them, which is already the stack's order.
const OVERLAY_Z_BAND = 1000;

/** zIndex for a ground entity of this kind. */
export function groundZIndex(kind: 'groundImage' | 'polygon' | 'circle' | 'polyline', zIndex: number | null | undefined): number {
  return overlayStackZ(kind, zIndex, { bandSize: OVERLAY_Z_BAND });
}
