import { AbstractZoomAltitudeConverter } from '@mapconductor/js-sdk-core';

export interface ZoomAltitudeViewportSize { width: number; height: number; }

export class ZoomAltitudeConverter extends AbstractZoomAltitudeConverter {
  static readonly REFERENCE_VIEWPORT_HEIGHT_PX = 540;

  constructor(
    zoom0Altitude = AbstractZoomAltitudeConverter.DEFAULT_ZOOM0_ALTITUDE,
    private readonly viewportSizeProvider: (() => ZoomAltitudeViewportSize | null) | null = null,
  ) { super(zoom0Altitude); }

  zoomLevelToAltitude({ zoomLevel, latitude, tilt }: { zoomLevel: number; latitude: number; tilt: number }): number {
    const distance = this.zoomLevelToDistance({ zoomLevel, latitude });
    return clamp(distance * this.cosTilt(tilt), AbstractZoomAltitudeConverter.MIN_ALTITUDE, AbstractZoomAltitudeConverter.MAX_ALTITUDE);
  }

  altitudeToZoomLevel({ altitude, latitude, tilt }: { altitude: number; latitude: number; tilt: number }): number {
    const distance = clamp(altitude, AbstractZoomAltitudeConverter.MIN_ALTITUDE, AbstractZoomAltitudeConverter.MAX_ALTITUDE) / this.cosTilt(tilt);
    return this.distanceToZoomLevel({ distance, latitude });
  }

  zoomLevelToDistance({ zoomLevel, latitude }: { zoomLevel: number; latitude: number }): number {
    const zoom = clamp(zoomLevel, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL, AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL);
    const distance = this.effectiveZoom0Altitude() * this.cosLatitude(latitude) / Math.pow(AbstractZoomAltitudeConverter.ZOOM_FACTOR, zoom);
    return clamp(distance, AbstractZoomAltitudeConverter.MIN_ALTITUDE, AbstractZoomAltitudeConverter.MAX_ALTITUDE);
  }

  distanceToZoomLevel({ distance, latitude }: { distance: number; latitude: number }): number {
    const value = clamp(distance, AbstractZoomAltitudeConverter.MIN_ALTITUDE, AbstractZoomAltitudeConverter.MAX_ALTITUDE);
    const zoom = Math.log2(this.effectiveZoom0Altitude() * this.cosLatitude(latitude) / value);
    return clamp(zoom, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL, AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL);
  }

  private effectiveZoom0Altitude(): number {
    const height = this.viewportSizeProvider?.()?.height;
    return height != null && Number.isFinite(height) && height > 0
      ? this.zoom0Altitude * height / ZoomAltitudeConverter.REFERENCE_VIEWPORT_HEIGHT_PX
      : this.zoom0Altitude;
  }

  private cosLatitude(latitude: number): number {
    return Math.max(AbstractZoomAltitudeConverter.MIN_COS_LAT, Math.abs(Math.cos(clamp(latitude, -85, 85) * Math.PI / 180)));
  }

  private cosTilt(tilt: number): number {
    return Math.max(AbstractZoomAltitudeConverter.MIN_COS_TILT, Math.cos(clamp(tilt, 0, 90) * Math.PI / 180));
  }
}

function clamp(value: number, min: number, max: number): number { return Math.min(Math.max(value, min), max); }
