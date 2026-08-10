import {
  Cartesian2,
  Cartesian3,
  BoundingSphere,
  Entity,
  EventHelper,
  HeadingPitchRange,
  Matrix4,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer,
} from 'cesium';
import {
  BaseMapViewController,
  MapUISettingsDiagnostics,
  type MapUISettings,
  computeFitBoundsCameraPosition,
  createGeoPoint,
  createGeoRectBounds,
  type CircleCapable,
  type GeoPoint,
  type GeoRectBounds,
  type GroundImageCapable,
  type GroundImageEvent,
  type MapCameraPosition,
  type MapViewControllerInterface,
  type MarkerAnimationOverlayHost,
  type MarkerCapable,
  type MarkerState,
  type OnMapInitializedHandler,
  type OnMarkerEventHandler,
  type PolygonCapable,
  type PolygonEvent,
  type PolylineCapable,
  type PolylineEvent,
  type RasterLayerCapable,
  type VisibleRegion,
} from '@mapconductor/js-sdk-core';
import { CesiumMapViewHolder } from './CesiumMapViewHolder';
import { CesiumMarkerController } from './marker/CesiumMarkerController';
import { CesiumCircleController } from './circle/CesiumCircleController';
import { CesiumPolylineController } from './polyline/CesiumPolylineController';
import { CesiumPolygonController } from './polygon/CesiumPolygonController';
import { CesiumGroundImageController } from './groundimage/CesiumGroundImageController';
import { CesiumRasterLayerController } from './raster/CesiumRasterLayerController';
import { parseCesiumEntityId, type CesiumOverlayKind } from './entityId';
import { toCameraPosition, toMapCameraPosition } from './MapCameraPosition';

const MARKER_DRAG_THRESHOLD_PX = 3;
// grabOffset: pointer-to-anchor offset captured on grab so the marker doesn't
// jump to the cursor when picked up by its icon body instead of its anchor.
interface MarkerDragState { marker: MarkerState; pointerDown: Cartesian2; grabOffset: { x: number; y: number }; started: boolean; cameraInputsWereEnabled: boolean; }

export class CesiumMapViewController extends BaseMapViewController implements MapViewControllerInterface, MarkerCapable, CircleCapable, PolylineCapable, PolygonCapable, GroundImageCapable, RasterLayerCapable {
  private readonly eventHelper = new EventHelper();
  private readonly input: ScreenSpaceEventHandler;
  private destroyed = false;
  private initialized = true;
  private isCameraMoving = false;
  private activeMarkerDrag: MarkerDragState | null = null;
  private suppressNextClick = false;
  private logicalTiltHint: number | null = null;

  constructor(
    readonly holder: CesiumMapViewHolder,
    private readonly markerController: CesiumMarkerController,
    private readonly circleController: CesiumCircleController,
    private readonly polylineController: CesiumPolylineController,
    private readonly polygonController: CesiumPolygonController,
    private readonly groundImageController: CesiumGroundImageController,
    private readonly rasterLayerController: CesiumRasterLayerController,
  ) {
    super();

    // Capable ファサードの既定実装がここから kind で引く。

    // **登録を忘れると composition が黙って捨てられる。**

    this.registerOverlayController(this.markerController);

    this.registerOverlayController(this.circleController);

    this.registerOverlayController(this.polylineController);

    this.registerOverlayController(this.polygonController);

    this.registerOverlayController(this.groundImageController);

    this.registerOverlayController(this.rasterLayerController);
    holder.setController(this);
    // Tiled markers render into a raster overlay driven by the raster controller.
    this.markerController.onRasterLayerUpdate = async state => {
      if (state) await this.rasterLayerController.composition([state]);
      else await this.rasterLayerController.clear();
    };
    this.input = new ScreenSpaceEventHandler(holder.map.scene.canvas);
    this.setupEvents();
    void this.notifyControllersCameraChanged(this.getCameraPosition());
  }

  getMap(): Viewer { return this.holder.map; }

  /**
   * Cesium's camera controller names its inputs after what they do to the
   * globe, not after the map gesture: in 3D a left drag *rotates* the globe,
   * which is what MapConductor calls scrolling.
   *
   * Heading and pitch share one input (`enableTilt` — a middle or ctrl drag
   * changes both), so rotate and tilt can only be switched off together. The
   * gesture left on is reported when the two flags disagree.
   */
  applyUISettings(settings: MapUISettings): void {
    const camera = this.holder.map.scene.screenSpaceCameraController;
    camera.enableRotate = settings.scrollGesture;
    camera.enableTranslate = settings.scrollGesture;
    camera.enableZoom = settings.zoomGesture;
    camera.enableTilt = settings.rotateGesture || settings.tiltGesture;
    camera.enableLook = settings.rotateGesture || settings.tiltGesture;

    if (settings.rotateGesture !== settings.tiltGesture) {
      MapUISettingsDiagnostics.warnIfRequested(
        false,
        settings.rotateGesture ? 'tilt' : 'rotate',
        'Cesium',
        'one drag changes heading and pitch together, so rotation and tilt can only be disabled together',
      );
    }
  }

  private setupEvents(): void {
    const camera = this.holder.map.camera;
    this.eventHelper.add(camera.moveStart, () => { this.isCameraMoving = true; this.notifyCameraMoveStart(this.getCameraPosition()); });
    this.eventHelper.add(this.holder.map.scene.preRender, () => { if (this.isCameraMoving) this.notifyCameraMove(this.getCameraPosition()); });
    this.eventHelper.add(camera.moveEnd, () => {
      this.isCameraMoving = false;
      const position = this.getCameraPosition();
      void this.notifyControllersCameraChanged(position);
      this.notifyCameraMoveEnd(position);
    });
    this.input.setInputAction((event: { position: Cartesian2 }) => this.handleClick(event.position, false), ScreenSpaceEventType.LEFT_CLICK);
    this.input.setInputAction((event: { position: Cartesian2 }) => this.handleClick(event.position, true), ScreenSpaceEventType.RIGHT_CLICK);
    this.input.setInputAction((event: { position: Cartesian2 }) => this.handleMarkerDragDown(event.position), ScreenSpaceEventType.LEFT_DOWN);
    this.input.setInputAction((event: { endPosition: Cartesian2 }) => this.handleMarkerDragMove(event.endPosition), ScreenSpaceEventType.MOUSE_MOVE);
    this.input.setInputAction((event: { position: Cartesian2 }) => this.handleMarkerDragUp(event.position), ScreenSpaceEventType.LEFT_UP);
  }

  private handleClick(screen: Cartesian2, longClick: boolean): void {
    if (!longClick && this.suppressNextClick) { this.suppressNextClick = false; return; }
    const clicked = this.holder.fromScreenOffsetSync({ x: screen.x, y: screen.y });
    if (!clicked) return;
    if (longClick) { this.notifyMapLongClick(clicked); return; }
    const picked = parsePickedEntity(this.holder.map.scene.pick(screen));
    if (picked && this.dispatchOverlayClick(picked.kind, picked.stateId, clicked)) return;
    // Tiled markers are drawn into a raster overlay (no entity to pick), so
    // hit-test them here — mirrors the Leaflet/Azure Maps controllers.
    const tiled = this.markerController.findTiled(clicked, this.getCameraPosition().zoom ?? 0);
    if (tiled?.state.clickable) { this.markerController.dispatchClick(tiled.state); return; }
    this.notifyMapClick(clicked);
  }

  private dispatchOverlayClick(kind: CesiumOverlayKind, id: string, clicked: GeoPoint): boolean {
    const marker = kind === 'marker' ? this.markerController.markerManager.getEntity(id)?.state : null;
    if (marker?.clickable) { this.markerController.dispatchClick(marker); return true; }
    const circle = kind === 'circle' ? this.circleController.circleManager.getEntity(id)?.state : null;
    if (circle?.clickable) { this.circleController.dispatchClick({ state: circle, clicked }); return true; }
    const polygon = kind === 'polygon' ? this.polygonController.polygonManager.getEntity(id)?.state : null;
    if (polygon) { this.polygonController.dispatchClick({ state: polygon, clicked } as PolygonEvent); return true; }
    const polyline = kind === 'polyline' ? this.polylineController.polylineManager.getEntity(id)?.state : null;
    if (polyline) { this.polylineController.dispatchClick({ state: polyline, clicked } as PolylineEvent); return true; }
    const groundImage = kind === 'ground-image' ? this.groundImageController.groundImageManager.getEntity(id)?.state : null;
    if (groundImage) { this.groundImageController.dispatchClick({ state: groundImage, clicked } as GroundImageEvent); return true; }
    return false;
  }

  private handleMarkerDragDown(screen: Cartesian2): void {
    if (this.activeMarkerDrag) return;
    const picked = parsePickedEntity(this.holder.map.scene.pick(screen));
    const marker = picked?.kind === 'marker' ? this.markerController.markerManager.getEntity(picked.stateId)?.state : null;
    if (!marker?.draggable) return;
    const cameraController = this.holder.map.scene.screenSpaceCameraController;
    const anchorScreen = this.holder.toScreenOffset(marker.position);
    const grabOffset = anchorScreen ? { x: anchorScreen.x - screen.x, y: anchorScreen.y - screen.y } : { x: 0, y: 0 };
    this.activeMarkerDrag = { marker, pointerDown: Cartesian2.clone(screen), grabOffset, started: false, cameraInputsWereEnabled: cameraController.enableInputs };
    cameraController.enableInputs = false;
  }

  private dragAnchorPosition(drag: MarkerDragState, screen: Cartesian2): GeoPoint | null {
    return this.holder.fromScreenOffsetSync({ x: screen.x + drag.grabOffset.x, y: screen.y + drag.grabOffset.y });
  }

  private handleMarkerDragMove(screen: Cartesian2): void {
    const drag = this.activeMarkerDrag;
    if (!drag) return;
    if (!drag.started) {
      if (Cartesian2.distance(screen, drag.pointerDown) < MARKER_DRAG_THRESHOLD_PX) return;
      drag.started = true;
      this.markerController.dispatchDragStart(drag.marker);
    }
    const position = this.dragAnchorPosition(drag, screen);
    if (!position) return;
    drag.marker.setPosition(position);
    this.markerController.updatePosition(drag.marker);
    this.markerController.dispatchDrag(drag.marker);
  }

  private handleMarkerDragUp(screen: Cartesian2): void {
    const drag = this.activeMarkerDrag;
    if (!drag) return;
    if (drag.started) {
      const position = this.dragAnchorPosition(drag, screen);
      if (position) { drag.marker.setPosition(position); this.markerController.updatePosition(drag.marker); }
      this.markerController.dispatchDragEnd(drag.marker);
      this.suppressNextClick = true;
      window.setTimeout(() => { this.suppressNextClick = false; }, 0);
    }
    this.restoreCameraInputs(drag.cameraInputsWereEnabled);
    this.activeMarkerDrag = null;
  }

  private restoreCameraInputs(enabled: boolean): void { this.holder.map.scene.screenSpaceCameraController.enableInputs = enabled; }

  override setMapInitializedListener(listener: OnMapInitializedHandler | null): void {
    super.setMapInitializedListener(listener);
    if (listener && this.initialized && !this.destroyed) queueMicrotask(() => this.notifyMapInitialized());
  }

  async moveCamera(position: MapCameraPosition): Promise<boolean> {
    return this.applyCamera(position, { animated: false });
  }
  async animateCamera(position: MapCameraPosition, durationMillis: number): Promise<boolean> {
    return this.applyCamera(position, { animated: true, duration: durationMillis });
  }
  /**
   * Shared camera commit. `snapZoom` defaults to true so explicit camera targets
   * quantize their zoom to match the Google Maps 2D reference; fitBounds passes
   * false to keep its fractional fit zoom (otherwise `padding` has no effect).
   */
  private async applyCamera(
    position: MapCameraPosition,
    { animated, duration, snapZoom = true }: { animated: boolean; duration?: number; snapZoom?: boolean },
  ): Promise<boolean> {
    this.logicalTiltHint = position.tilt;
    const { target, offset } = this.orbitCamera(position, snapZoom);
    if (!animated) {
      this.holder.map.camera.lookAt(target, offset);
      this.holder.map.camera.lookAtTransform(Matrix4.IDENTITY);
      return true;
    }
    return new Promise(resolve => this.holder.map.camera.flyToBoundingSphere(
      new BoundingSphere(target, 0),
      {
        offset,
        duration: (duration ?? 500) / 1000,
        complete: () => { this.holder.map.camera.lookAtTransform(Matrix4.IDENTITY); resolve(true); },
        cancel: () => resolve(false),
      },
    ));
  }
  // Unified fit: the core computes center + zoom from the bounds and padded
  // viewport; moveCamera keeps the current heading/pitch (Cesium's own Rectangle
  // fit would reset to top-down). See computeFitBoundsCameraPosition.
  fitBounds(bounds: GeoRectBounds, padding: number): Promise<boolean> {
    if (!bounds.southWest || !bounds.northEast) return Promise.resolve(false);
    const canvas = this.holder.map.canvas;
    const current = this.getCameraPosition();
    const fit = computeFitBoundsCameraPosition({
      bounds,
      viewportWidthPx: canvas.clientWidth,
      viewportHeightPx: canvas.clientHeight,
      padding,
      bearing: current.bearing,
    });
    if (!fit) return Promise.resolve(false);
    const target = current.copy({ position: fit.center, zoom: fit.zoom });
    // snapZoom:false — keep the fractional fit zoom so `padding` is honored.
    return this.applyCamera(target, { animated: false, snapZoom: false });
  }

  getCameraPosition(): MapCameraPosition {
    const camera = this.holder.map.camera;
    const cartographic = camera.positionCartographic;
    const center = this.holder.fromScreenOffsetSync({ x: this.holder.map.canvas.clientWidth / 2, y: this.holder.map.canvas.clientHeight / 2 });
    const position = center ?? createGeoPoint({ longitude: CesiumMath.toDegrees(cartographic.longitude), latitude: CesiumMath.toDegrees(cartographic.latitude) });
    const tilt = CesiumMath.toDegrees(camera.pitch) + 90;
    const target = Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude ?? 0);
    const range = Cartesian3.distance(camera.positionWC, target);
    return toMapCameraPosition({
      target: position,
      zoom: this.holder.zoomConverter.distanceToZoomLevel({ distance: range, latitude: position.latitude }),
      bearing: normalizeDegrees(CesiumMath.toDegrees(camera.heading)),
      tilt,
      logicalTiltHint: this.logicalTiltHint,
      converter: this.holder.zoomConverter,
    }).copy({ visibleRegion: this.getVisibleRegion() });
  }

  private getVisibleRegion(): VisibleRegion | null {
    const canvas = this.holder.map.canvas;
    const corners = [
      this.holder.fromScreenOffsetSync({ x: 0, y: canvas.clientHeight }),
      this.holder.fromScreenOffsetSync({ x: canvas.clientWidth, y: canvas.clientHeight }),
      this.holder.fromScreenOffsetSync({ x: 0, y: 0 }),
      this.holder.fromScreenOffsetSync({ x: canvas.clientWidth, y: 0 }),
    ];
    if (corners.some(value => !value)) return null;
    const [nearLeft, nearRight, farLeft, farRight] = corners as GeoPoint[];
    const bounds = createGeoRectBounds(); corners.forEach(value => bounds.extend(value!));
    return { bounds, nearLeft, nearRight, farLeft, farRight };
  }

  private orbitCamera(
    position: MapCameraPosition,
    snapZoom = true,
  ): { target: Cartesian3; offset: HeadingPitchRange } {
    const camera = toCameraPosition(position, this.holder.zoomConverter, { snapZoom });
    const target = Cartesian3.fromDegrees(camera.target.longitude, camera.target.latitude, camera.target.altitude ?? 0);
    const range = this.holder.zoomConverter.zoomLevelToDistance({ zoomLevel: camera.zoom, latitude: camera.target.latitude });
    const offset = new HeadingPitchRange(
      CesiumMath.toRadians(camera.bearing),
      CesiumMath.toRadians(Math.max(0, Math.min(89, camera.tilt)) - 90),
      range,
    );
    return { target, offset };
  }

  private async notifyControllersCameraChanged(position: MapCameraPosition): Promise<void> {
    await Promise.all([
      this.markerController.onCameraChanged(position), this.circleController.onCameraChanged(position),
      this.polylineController.onCameraChanged(position), this.polygonController.onCameraChanged(position),
      this.groundImageController.onCameraChanged(position), this.rasterLayerController.onCameraChanged(position),
    ]);
  }

  setOnMarkerClickListener(value: OnMarkerEventHandler | null): void { this.markerController.setOnClickListener(value); }
  setOnMarkerDragStart(value: OnMarkerEventHandler | null): void { this.markerController.setOnDragStart(value); }
  setOnMarkerDrag(value: OnMarkerEventHandler | null): void { this.markerController.setOnDrag(value); }
  setOnMarkerDragEnd(value: OnMarkerEventHandler | null): void { this.markerController.setOnDragEnd(value); }
  setOnMarkerAnimateStart(value: OnMarkerEventHandler | null): void { this.markerController.setOnAnimateStart(value); }
  setOnMarkerAnimateEnd(value: OnMarkerEventHandler | null): void { this.markerController.setOnAnimateEnd(value); }
  setMarkerAnimationOverlayHost(host: MarkerAnimationOverlayHost | null): void { this.markerController.setMarkerAnimationOverlayHost(host); }

  async clearOverlays(): Promise<void> {
    await Promise.all([this.markerController.clear(), this.circleController.clear(), this.polylineController.clear(), this.polygonController.clear(), this.groundImageController.clear(), this.rasterLayerController.clear()]);
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true; this.initialized = false;
    if (this.activeMarkerDrag) this.restoreCameraInputs(this.activeMarkerDrag.cameraInputsWereEnabled);
    this.activeMarkerDrag = null;
    this.markerController.destroy();
    this.holder.setController(null);
    this.input.destroy(); this.eventHelper.removeAll();
  }
}

function parsePickedEntity(value: unknown): ReturnType<typeof parseCesiumEntityId> {
  const picked = value as { id?: Entity } | undefined;
  return picked?.id?.id ? parseCesiumEntityId(picked.id.id) : null;
}
function normalizeDegrees(value: number): number { return ((value % 360) + 360) % 360; }
