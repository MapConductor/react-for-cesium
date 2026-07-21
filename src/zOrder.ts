// Cesium orders ground geometry (entities without height / with clampToGround)
// by their zIndex property. Mirror the overlay stacking convention from
// js-sdk-core's controllers — groundImage(2) < circle/polygon(3) < polyline(5)
// < marker(10) — by spreading each overlay type into its own band and adding
// the per-state zIndex within it.
export const OVERLAY_Z_BAND = 1000;
export const GROUND_IMAGE_Z_BASE = 2 * OVERLAY_Z_BAND;
export const CIRCLE_Z_BASE = 3 * OVERLAY_Z_BAND;
export const POLYGON_Z_BASE = 3 * OVERLAY_Z_BAND;
export const POLYLINE_Z_BASE = 5 * OVERLAY_Z_BAND;
