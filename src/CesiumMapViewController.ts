import {
  Cartesian2,
  Cartesian3,
  BoundingSphere,
  Entity,
  EventHelper,
  HeadingPitchRange,
  Matrix4,
  Math as CesiumMath,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer,
} from 'cesium';
import {
  BaseMapViewController,
  createGeoPoint,
  createGeoRectBounds,
  createMapCameraPosition,
  type CameraOptions,
  type CircleCapable,
  type CircleState,
  type GeoPoint,
  type GeoRectBounds,
  type GroundImageCapable,
  type GroundImageEvent,
  type GroundImageState,
  type MapCameraPosition,
  type MapViewControllerInterface,
  type MarkerAnimationOverlayHost,
  type MarkerCapable,
  type MarkerState,
  type OnCircleEventHandler,
  type OnGroundImageEventHandler,
  type OnMapInitializedHandler,
  type OnMarkerEventHandler,
  type OnPolygonEventHandler,
  type OnPolylineEventHandler,
  type PolygonCapable,
  type PolygonEvent,
  type PolygonState,
  type PolylineCapable,
  type PolylineEvent,
  type PolylineState,
  type RasterLayerCapable,
  type RasterLayerState,
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

const MARKER_DRAG_THRESHOLD_PX = 3;
interface MarkerDragState { marker: MarkerState; pointerDown: Cartesian2; started: boolean; cameraInputsWereEnabled: boolean; }

export class CesiumMapViewController extends BaseMapViewController implements MapViewControllerInterface, MarkerCapable, CircleCapable, PolylineCapable, PolygonCapable, GroundImageCapable, RasterLayerCapable {
  private readonly eventHelper = new EventHelper();
  private readonly input: ScreenSpaceEventHandler;
  private destroyed = false;
  private initialized = true;
  private isCameraMoving = false;
  private activeMarkerDrag: MarkerDragState | null = null;
  private suppressNextClick = false;

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
    holder.setController(this);
    this.input = new ScreenSpaceEventHandler(holder.map.scene.canvas);
    this.setupEvents();
    void this.notifyControllersCameraChanged(this.getCameraPosition());
  }

  getMap(): Viewer { return this.holder.map; }

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
    if (!picked || !this.dispatchOverlayClick(picked.kind, picked.stateId, clicked)) this.notifyMapClick(clicked);
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
    this.activeMarkerDrag = { marker, pointerDown: Cartesian2.clone(screen), started: false, cameraInputsWereEnabled: cameraController.enableInputs };
    cameraController.enableInputs = false;
  }

  private handleMarkerDragMove(screen: Cartesian2): void {
    const drag = this.activeMarkerDrag;
    if (!drag) return;
    if (!drag.started) {
      if (Cartesian2.distance(screen, drag.pointerDown) < MARKER_DRAG_THRESHOLD_PX) return;
      drag.started = true;
      this.markerController.dispatchDragStart(drag.marker);
    }
    const position = this.holder.fromScreenOffsetSync({ x: screen.x, y: screen.y });
    if (!position) return;
    drag.marker.setPosition(position);
    this.markerController.updatePosition(drag.marker);
    this.markerController.dispatchDrag(drag.marker);
  }

  private handleMarkerDragUp(screen: Cartesian2): void {
    const drag = this.activeMarkerDrag;
    if (!drag) return;
    if (drag.started) {
      const position = this.holder.fromScreenOffsetSync({ x: screen.x, y: screen.y });
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
    const { target, offset } = this.orbitCamera(position);
    this.holder.map.camera.lookAt(target, offset);
    this.holder.map.camera.lookAtTransform(Matrix4.IDENTITY);
    return true;
  }
  async animateCamera(position: MapCameraPosition, options?: CameraOptions): Promise<boolean> {
    const { target, offset } = this.orbitCamera(position);
    return new Promise(resolve => this.holder.map.camera.flyToBoundingSphere(
      new BoundingSphere(target, 0),
      {
        offset,
        duration: (options?.duration ?? 500) / 1000,
        complete: () => { this.holder.map.camera.lookAtTransform(Matrix4.IDENTITY); resolve(true); },
        cancel: () => resolve(false),
      },
    ));
  }
  async fitBounds(bounds: GeoRectBounds, options?: CameraOptions): Promise<boolean> {
    if (!bounds.southWest || !bounds.northEast) return false;
    const destination = Rectangle.fromDegrees(bounds.southWest.longitude, bounds.southWest.latitude, bounds.northEast.longitude, bounds.northEast.latitude);
    if (!options?.duration) { this.holder.map.camera.setView({ destination }); return true; }
    return new Promise(resolve => this.holder.map.camera.flyTo({ destination, duration: options.duration! / 1000, complete: () => resolve(true), cancel: () => resolve(false) }));
  }

  getCameraPosition(): MapCameraPosition {
    const camera = this.holder.map.camera;
    const cartographic = camera.positionCartographic;
    const center = this.holder.fromScreenOffsetSync({ x: this.holder.map.canvas.clientWidth / 2, y: this.holder.map.canvas.clientHeight / 2 });
    const position = center ?? createGeoPoint({ longitude: CesiumMath.toDegrees(cartographic.longitude), latitude: CesiumMath.toDegrees(cartographic.latitude) });
    const tilt = CesiumMath.toDegrees(camera.pitch) + 90;
    const target = Cartesian3.fromDegrees(position.longitude, position.latitude, position.altitude ?? 0);
    const range = Cartesian3.distance(camera.positionWC, target);
    return createMapCameraPosition({
      position,
      zoom: this.holder.zoomConverter.distanceToZoomLevel({ distance: range, latitude: position.latitude }),
      bearing: normalizeDegrees(CesiumMath.toDegrees(camera.heading)),
      tilt,
      visibleRegion: this.getVisibleRegion(),
    });
  }
  getBounds(): GeoRectBounds | null { return this.getVisibleRegion()?.bounds ?? null; }

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

  private orbitCamera(position: MapCameraPosition): { target: Cartesian3; offset: HeadingPitchRange } {
    const target = Cartesian3.fromDegrees(position.position.longitude, position.position.latitude, position.position.altitude ?? 0);
    const range = this.holder.zoomConverter.zoomLevelToDistance({ zoomLevel: position.zoom, latitude: position.position.latitude });
    const offset = new HeadingPitchRange(
      CesiumMath.toRadians(position.bearing),
      CesiumMath.toRadians(Math.max(0, Math.min(89, position.tilt)) - 90),
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

  async compositionMarkers(data: MarkerState[]): Promise<void> { await this.markerController.composition(data); }
  async updateMarker(state: MarkerState): Promise<void> { await this.markerController.update(state); }
  hasMarker(state: MarkerState): boolean { return this.markerController.has(state); }
  setOnMarkerClickListener(value: OnMarkerEventHandler | null): void { this.markerController.setOnClickListener(value); }
  setOnMarkerDragStart(value: OnMarkerEventHandler | null): void { this.markerController.setOnDragStart(value); }
  setOnMarkerDrag(value: OnMarkerEventHandler | null): void { this.markerController.setOnDrag(value); }
  setOnMarkerDragEnd(value: OnMarkerEventHandler | null): void { this.markerController.setOnDragEnd(value); }
  setOnMarkerAnimateStart(value: OnMarkerEventHandler | null): void { this.markerController.setOnAnimateStart(value); }
  setOnMarkerAnimateEnd(value: OnMarkerEventHandler | null): void { this.markerController.setOnAnimateEnd(value); }
  setMarkerAnimationOverlayHost(host: MarkerAnimationOverlayHost | null): void { this.markerController.setMarkerAnimationOverlayHost(host); }
  async compositionCircles(data: CircleState[]): Promise<void> { await this.circleController.composition(data); }
  async updateCircle(state: CircleState): Promise<void> { await this.circleController.update(state); }
  hasCircle(state: CircleState): boolean { return this.circleController.has(state); }
  setOnCircleClickListener(value: OnCircleEventHandler | null): void { this.circleController.setOnClickListener(value); }
  async compositionPolylines(data: PolylineState[]): Promise<void> { await this.polylineController.composition(data); }
  async updatePolyline(state: PolylineState): Promise<void> { await this.polylineController.update(state); }
  hasPolyline(state: PolylineState): boolean { return this.polylineController.has(state); }
  setOnPolylineClickListener(value: OnPolylineEventHandler | null): void { this.polylineController.setOnClickListener(value); }
  async compositionPolygons(data: PolygonState[]): Promise<void> { await this.polygonController.composition(data); }
  async updatePolygon(state: PolygonState): Promise<void> { await this.polygonController.update(state); }
  hasPolygon(state: PolygonState): boolean { return this.polygonController.has(state); }
  setOnPolygonClickListener(value: OnPolygonEventHandler | null): void { this.polygonController.setOnClickListener(value); }
  async compositionGroundImages(data: GroundImageState[]): Promise<void> { await this.groundImageController.composition(data); }
  async updateGroundImage(state: GroundImageState): Promise<void> { await this.groundImageController.update(state); }
  hasGroundImage(state: GroundImageState): boolean { return this.groundImageController.has(state); }
  setOnGroundImageClickListener(value: OnGroundImageEventHandler | null): void { this.groundImageController.setOnClickListener(value); }
  async compositionRasterLayers(data: RasterLayerState[]): Promise<void> { await this.rasterLayerController.composition(data); }
  async updateRasterLayer(state: RasterLayerState): Promise<void> { await this.rasterLayerController.update(state); }
  hasRasterLayer(state: RasterLayerState): boolean { return this.rasterLayerController.has(state); }

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
