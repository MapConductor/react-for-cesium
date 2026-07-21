import {
  computeOffset,
  createMapCameraPosition,
  type GeoPoint,
  type MapCameraPosition,
} from '@mapconductor/js-sdk-core';
import { ZoomAltitudeConverter } from './zoom/ZoomAltitudeConverter';

const NEGATIVE_TILT_TARGET_DISTANCE_SCALE = 1.83;
const NEGATIVE_TILT_ZOOM_OFFSET_AT_MAX_TILT = -0.9;
const MAX_NEGATIVE_TILT = 60;

export interface CesiumCameraPosition {
  target: GeoPoint;
  zoom: number;
  bearing: number;
  tilt: number;
}

/**
 * Converts a logical MapConductor camera into the downward-looking camera
 * Cesium renders. A negative tilt is emulated by moving the target forward,
 * using the corresponding positive tilt, and compensating the zoom.
 */
export function toCameraPosition(
  position: MapCameraPosition,
  converter: ZoomAltitudeConverter,
): CesiumCameraPosition {
  if (position.tilt >= 0) {
    return {
      target: position.position,
      zoom: position.zoom,
      bearing: position.bearing,
      tilt: position.tilt,
    };
  }

  const tiltAbs = Math.min(Math.abs(position.tilt), MAX_NEGATIVE_TILT);
  const tiltAbsRad = (tiltAbs * Math.PI) / 180;
  const distance = converter.zoomLevelToDistance({
    zoomLevel: position.zoom,
    latitude: position.position.latitude,
  });
  const target = computeOffset({
    origin: position.position,
    distance: distance * Math.cos(tiltAbsRad) * Math.tan(tiltAbsRad) * NEGATIVE_TILT_TARGET_DISTANCE_SCALE,
    heading: position.bearing,
  });

  return {
    target,
    zoom: position.zoom + NEGATIVE_TILT_ZOOM_OFFSET_AT_MAX_TILT * (tiltAbs / MAX_NEGATIVE_TILT),
    bearing: position.bearing,
    tilt: tiltAbs,
  };
}

/** Restores the logical negative tilt from Cesium's emulated camera state. */
export function toMapCameraPosition({
  target,
  zoom,
  bearing,
  tilt,
  logicalTiltHint = null,
  converter,
}: CesiumCameraPosition & {
  logicalTiltHint?: number | null;
  converter: ZoomAltitudeConverter;
}): MapCameraPosition {
  const tiltAbs = Math.min(Math.abs(tilt), MAX_NEGATIVE_TILT);
  if (logicalTiltHint != null && logicalTiltHint < 0 && tiltAbs > 0) {
    const tiltAbsRad = (tiltAbs * Math.PI) / 180;
    const originalZoom = zoom - NEGATIVE_TILT_ZOOM_OFFSET_AT_MAX_TILT * (tiltAbs / MAX_NEGATIVE_TILT);
    const distance = converter.zoomLevelToDistance({ zoomLevel: originalZoom, latitude: target.latitude });
    const position = computeOffset({
      origin: target,
      distance: distance * Math.cos(tiltAbsRad) * Math.tan(tiltAbsRad) * NEGATIVE_TILT_TARGET_DISTANCE_SCALE,
      heading: bearing + 180,
    });
    return createMapCameraPosition({ position, zoom: originalZoom, bearing, tilt: -tiltAbs });
  }

  return createMapCameraPosition({ position: target, zoom, bearing, tilt });
}
