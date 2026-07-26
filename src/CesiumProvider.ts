import {
  Cartesian3,
  Cartographic,
  HeadingPitchRange,
  ImageryLayer,
  Math as CesiumMath,
  Matrix4,
  PerspectiveFrustum,
  Viewer,
} from 'cesium';
import { MapProvider, type MapViewControllerInterface } from '@mapconductor/js-sdk-core';
import { CesiumMapViewController } from './CesiumMapViewController';
import { CesiumMapViewHolder } from './CesiumMapViewHolder';
import { ZoomAltitudeConverter } from './zoom';
import { CesiumMarkerController } from './marker/CesiumMarkerController';
import { CesiumMarkerRenderer } from './marker/CesiumMarkerRenderer';
import { CesiumCircleController } from './circle/CesiumCircleController';
import { CesiumCircleOverlayRenderer } from './circle/CesiumCircleOverlayRenderer';
import { CesiumPolylineController } from './polyline/CesiumPolylineController';
import { CesiumPolylineOverlayRenderer } from './polyline/CesiumPolylineOverlayRenderer';
import { CesiumPolygonController } from './polygon/CesiumPolygonController';
import { CesiumPolygonOverlayRenderer } from './polygon/CesiumPolygonOverlayRenderer';
import { CesiumGroundImageController } from './groundimage/CesiumGroundImageController';
import { CesiumGroundImageOverlayRenderer } from './groundimage/CesiumGroundImageOverlayRenderer';
import { CesiumRasterLayerController } from './raster/CesiumRasterLayerController';
import { CesiumRasterLayerOverlayRenderer } from './raster/CesiumRasterLayerOverlayRenderer';
import type { CesiumConfig } from './CesiumMapConfig';

export class CesiumProvider extends MapProvider {
  private viewer: Viewer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  async initialize(config: CesiumConfig): Promise<MapViewControllerInterface> {
    if (this.controller) return this.controller;
    const container = typeof config.container === 'string' ? document.getElementById(config.container) : config.container;
    if (!container) throw new Error('Container element not found');
    const imageryProvider = config.mapDesignType.imageryProvider;
    const viewer = new Viewer(container, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      ...(imageryProvider === null ? { baseLayer: false } : { baseLayer: new ImageryLayer(imageryProvider) }),
      ...config.options,
    });
    setGoogleMaps3DFieldOfView(viewer);
    this.viewer = viewer;
    const zoomConverter = new ZoomAltitudeConverter(
      ZoomAltitudeConverter.DEFAULT_ZOOM0_ALTITUDE,
      () => ({ width: container.clientWidth, height: container.clientHeight }),
    );

    // No native rectangular pan restriction exists for Cesium's globe camera,
    // so minZoom/maxZoom go through screenSpaceCameraController's zoom-distance
    // clamp (the native equivalent for zoom), and restrictBounds is enforced
    // by clamping the camera's ground position every frame (the common Cesium
    // pattern, same approach used for ArcGIS SceneView).
    const referenceLatitude = config.initCameraPosition?.position.latitude ?? 0;
    const cameraController = viewer.scene.screenSpaceCameraController;
    if (config.maxZoom !== undefined) {
      cameraController.minimumZoomDistance = zoomConverter.zoomLevelToDistance({
        zoomLevel: config.maxZoom,
        latitude: referenceLatitude,
      });
    }
    if (config.minZoom !== undefined) {
      cameraController.maximumZoomDistance = zoomConverter.zoomLevelToDistance({
        zoomLevel: config.minZoom,
        latitude: referenceLatitude,
      });
    }

    const restrictBounds = config.restrictBounds;
    if (restrictBounds?.southWest && restrictBounds.northEast) {
      const minLon = CesiumMath.toRadians(restrictBounds.southWest.longitude);
      const maxLon = CesiumMath.toRadians(restrictBounds.northEast.longitude);
      const minLat = CesiumMath.toRadians(restrictBounds.southWest.latitude);
      const maxLat = CesiumMath.toRadians(restrictBounds.northEast.latitude);
      viewer.scene.postRender.addEventListener(() => {
        if (viewer.isDestroyed()) return;
        const cartographic = Cartographic.fromCartesian(viewer.camera.positionWC);
        const clampedLon = Math.min(Math.max(cartographic.longitude, minLon), maxLon);
        const clampedLat = Math.min(Math.max(cartographic.latitude, minLat), maxLat);
        if (clampedLon === cartographic.longitude && clampedLat === cartographic.latitude) return;
        viewer.camera.position = Cartesian3.fromRadians(clampedLon, clampedLat, cartographic.height);
      });
    }
    const holder = new CesiumMapViewHolder(container, viewer, zoomConverter);
    const controller = new CesiumMapViewController(
      holder,
      new CesiumMarkerController(new CesiumMarkerRenderer(holder), config.markerTilingOptions),
      new CesiumCircleController(new CesiumCircleOverlayRenderer(holder)),
      new CesiumPolylineController(new CesiumPolylineOverlayRenderer(holder)),
      new CesiumPolygonController(new CesiumPolygonOverlayRenderer(holder)),
      new CesiumGroundImageController(new CesiumGroundImageOverlayRenderer(holder)),
      new CesiumRasterLayerController(new CesiumRasterLayerOverlayRenderer(holder)),
    );
    this.controller = controller;
    let previousHeight = container.clientHeight;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (viewer.isDestroyed()) return;
        const nextHeight = container.clientHeight;
        setGoogleMaps3DFieldOfView(viewer);
        if (nextHeight <= 0 || nextHeight === previousHeight) return;
        if (previousHeight <= 0) { previousHeight = nextHeight; return; }
        const camera = viewer.camera;
        const center = holder.fromScreenOffsetSync({
          x: viewer.canvas.clientWidth / 2,
          y: viewer.canvas.clientHeight / 2,
        });
        if (center) {
          const target = Cartesian3.fromDegrees(center.longitude, center.latitude, center.altitude ?? 0);
          const range = Cartesian3.distance(camera.positionWC, target) * nextHeight / previousHeight;
          camera.lookAt(target, new HeadingPitchRange(camera.heading, camera.pitch, range));
          camera.lookAtTransform(Matrix4.IDENTITY);
        }
        previousHeight = nextHeight;
      });
      this.resizeObserver.observe(container);
    }
    if (config.initCameraPosition) await controller.moveCamera(config.initCameraPosition);
    return controller;
  }
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.controller?.destroy(); this.controller = null;
    if (this.viewer && !this.viewer.isDestroyed()) this.viewer.destroy();
    this.viewer = null;
  }
}

const GOOGLE_MAPS_3D_VERTICAL_FOV_DEGREES = 35;

function setGoogleMaps3DFieldOfView(viewer: Viewer): void {
  if (viewer.isDestroyed()) return;
  const frustum = viewer.camera.frustum;
  if (!(frustum instanceof PerspectiveFrustum)) return;
  const aspect = viewer.canvas.clientHeight > 0
    ? viewer.canvas.clientWidth / viewer.canvas.clientHeight
    : 1;
  const verticalFov = CesiumMath.toRadians(GOOGLE_MAPS_3D_VERTICAL_FOV_DEGREES);
  frustum.fov = aspect > 1
    ? 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
    : verticalFov;
}
