import { MapDesignTypeInterface, AttributionRule, MapViewStateInterface, MapViewState, MapCameraPosition, MapViewControllerInterface, MapViewBaseProps, MarkerTilingOptions, GeoRectBounds, AbstractZoomAltitudeConverter, MapViewHolderBase, GeoPointInterface, Offset, GeoPoint, MarkerOverlayRenderer, MarkerEntity, AbstractMarkerOverlayRenderer, AddParams, ChangeParams, MarkerState, AbstractMarkerController, RasterLayerState, CircleOverlayRenderer, CircleAddParams, CircleChangeParams, CircleEntity, CircleController, PolylineOverlayRenderer, PolylineAddParams, PolylineChangeParams, PolylineEntity, PolylineController, PolygonOverlayRenderer, PolygonAddParams, PolygonChangeParams, PolygonEntity, PolygonController, GroundImageOverlayRenderer, GroundImageAddParams, GroundImageChangeParams, GroundImageEntity, GroundImageController, RasterLayerOverlayRenderer, RasterLayerAddParams, RasterLayerChangeParams, RasterLayerEntity, RasterLayerController, RasterHeaderSupport, BaseMapViewController, MarkerCapable, CircleCapable, PolylineCapable, PolygonCapable, GroundImageCapable, RasterLayerCapable, MapUISettings, OnMapInitializedHandler, OnMarkerEventHandler, MarkerAnimationOverlayHost, MapConfig, MapProvider } from '@mapconductor/js-sdk-core';
import { ImageryProvider, Viewer, Entity, ImageryLayer } from 'cesium';
import * as react from 'react';
import { CSSProperties, ReactNode } from 'react';

interface CesiumMapDesignType extends MapDesignTypeInterface<string> {
    readonly imageryProvider: ImageryProvider | null;
}
interface CesiumDesignParams {
    id: string;
    imageryProvider?: ImageryProvider | null;
    attributionRules?: readonly AttributionRule[];
}
declare class CesiumDesign implements CesiumMapDesignType {
    readonly id: string;
    readonly imageryProvider: ImageryProvider | null;
    readonly attributionRules: readonly AttributionRule[];
    constructor({ id, imageryProvider, attributionRules }: CesiumDesignParams);
    getValue(): string;
    static readonly Default: CesiumDesign;
    static readonly None: CesiumDesign;
}

interface CesiumMapViewStateInterface extends MapViewStateInterface<CesiumMapDesignType> {
}
interface CesiumMapViewStateParams {
    id?: string;
    mapDesignType?: CesiumMapDesignType;
    cameraPosition?: MapCameraPosition;
}
declare class CesiumMapViewState extends MapViewState<CesiumMapDesignType> implements CesiumMapViewStateInterface {
    private _mapDesignType;
    constructor({ id, mapDesignType, cameraPosition }?: CesiumMapViewStateParams);
    get mapDesignType(): CesiumMapDesignType;
    set mapDesignType(value: CesiumMapDesignType);
    /** このプロバイダは接続時にカメラを動かさない（ビュー側が別経路で初期位置を当てる）。 */
    setController(controller: MapViewControllerInterface | null): void;
}
declare function useCesiumMapViewState(params?: CesiumMapViewStateParams): CesiumMapViewStateInterface;

interface CesiumMapViewProps extends MapViewBaseProps<CesiumMapViewStateInterface> {
    className?: string;
    containerStyle?: CSSProperties;
    options?: NonNullable<ConstructorParameters<typeof Viewer>[1]>;
    onError?: (error: Error) => void;
    children?: ReactNode;
    markerTilingOptions?: MarkerTilingOptions;
    minZoom?: number;
    maxZoom?: number;
    /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
    restrictBounds?: GeoRectBounds;
}

declare function CesiumMapView({ state, onMapLoaded, onMapClick, onMapLongClick, onCameraMoveStart, onCameraMove, onCameraMoveEnd, className, containerStyle, options, onError, children, markerTilingOptions, minZoom, maxZoom, restrictBounds, cameraRestriction }: CesiumMapViewProps): react.JSX.Element;

interface ZoomAltitudeViewportSize {
    width: number;
    height: number;
}
declare class ZoomAltitudeConverter extends AbstractZoomAltitudeConverter {
    private readonly viewportSizeProvider;
    static readonly REFERENCE_VIEWPORT_HEIGHT_PX = 690;
    constructor(zoom0Altitude?: number, viewportSizeProvider?: (() => ZoomAltitudeViewportSize | null) | null);
    zoomLevelToAltitude({ zoomLevel, latitude, tilt }: {
        zoomLevel: number;
        latitude: number;
        tilt: number;
    }): number;
    altitudeToZoomLevel({ altitude, latitude, tilt }: {
        altitude: number;
        latitude: number;
        tilt: number;
    }): number;
    zoomLevelToDistance({ zoomLevel, latitude }: {
        zoomLevel: number;
        latitude: number;
    }): number;
    distanceToZoomLevel({ distance, latitude }: {
        distance: number;
        latitude: number;
    }): number;
    private effectiveZoom0Altitude;
    private cosLatitude;
    private cosTilt;
}

declare class CesiumMapViewHolder extends MapViewHolderBase<HTMLElement, Viewer> {
    readonly mapView: HTMLElement;
    readonly map: Viewer;
    readonly zoomConverter: ZoomAltitudeConverter;
    private controller;
    constructor(mapView: HTMLElement, map: Viewer, zoomConverter: ZoomAltitudeConverter);
    getController(): CesiumMapViewController | null;
    setController(controller: CesiumMapViewController | null): void;
    isDestroyed(): boolean;
    toScreenOffset(position: GeoPointInterface): Offset | null;
    fromScreenOffsetSync(offset: Offset): GeoPoint | null;
}

interface CesiumMarkerRendererInterface extends MarkerOverlayRenderer<Entity> {
    setMarkerPosition(entity: MarkerEntity<Entity>, position: GeoPoint): void;
}

declare class CesiumMarkerRenderer extends AbstractMarkerOverlayRenderer<CesiumMapViewHolder, Entity> implements CesiumMarkerRendererInterface {
    /** 追従中のマーカー Entity。毎フレームの裏側判定（オクルージョン）で走査する。 */
    private readonly markerEntities;
    /** 直近に適用した「表示可否（裏側でない）」。値が変わったときだけ show を更新するためのキャッシュ。 */
    private readonly occlusionState;
    /**
     * カメラ位置から見て地球の裏側かどうかを判定するオクルーダー。
     * 地球を「極半径（最小半径）の球」で近似する。極半径にすることで、可視マーカーを誤って
     * 隠すことなく、明確に裏側にある点だけを非表示にする（水平線付近は保守的に可視側へ倒す）。
     */
    private readonly occluder;
    private readonly scratchPosition;
    constructor(holder: CesiumMapViewHolder);
    onAdd(data: AddParams[]): Promise<(Entity | null)[]>;
    onChange(data: ChangeParams<Entity>[]): Promise<(Entity | null)[]>;
    onRemove(data: MarkerEntity<Entity>[]): Promise<void>;
    onPostProcess(): Promise<void>;
    setMarkerVisible(entity: MarkerEntity<Entity>, visible: boolean): void;
    setMarkerPosition(entity: MarkerEntity<Entity>, position: MarkerState['position']): void;
    /**
     * 地球の裏側（カメラから見て水平線の向こう）にあるマーカーを非表示にする。
     * `preRender` で毎フレーム呼ばれるので、fly-to 等のカメラ移動にも追従する。
     */
    private readonly updateOcclusion;
    private createEntity;
    private apply;
}

/**
 * Cesium marker controller.
 *
 * Small marker sets render as individual Cesium entities (full icon fidelity,
 * drag, per-marker click). Large sets are tiled: rendered off-screen into a
 * raster overlay (see {@link MarkerTileRenderer}) served through the shared tile
 * service worker, so tens of thousands of markers stay performant. Mirrors the
 * Leaflet/Azure Maps marker controllers.
 */
declare class CesiumMarkerController extends AbstractMarkerController<Entity> {
    private readonly tilingOptions;
    readonly renderer: CesiumMarkerRenderer;
    private tileRenderer;
    private tileRouteId;
    private tileVersion;
    private tileGeneration;
    /** Wired by CesiumMapViewController to drive the tiled-marker raster overlay. */
    onRasterLayerUpdate: ((state: RasterLayerState | null) => Promise<void>) | null;
    constructor(renderer: CesiumMarkerRenderer, tilingOptions?: MarkerTilingOptions);
    updatePosition(state: MarkerState): void;
    /** Nearest tiled (raster) marker to a clicked point, or null. */
    findTiled(position: GeoPoint, zoom: number): MarkerEntity<Entity> | null;
    protected shouldTile(state: MarkerState, totalCount: number): boolean;
    protected onTiledMarkersChanged(): Promise<void>;
    clear(): Promise<void>;
    destroy(): void;
    private syncTiledOverlay;
    private removeTileOverlay;
}

declare class CesiumCircleOverlayRenderer implements CircleOverlayRenderer<Entity> {
    readonly holder: CesiumMapViewHolder;
    constructor(holder: CesiumMapViewHolder);
    onAdd(data: CircleAddParams[]): Promise<(Entity | null)[]>;
    onChange(data: CircleChangeParams<Entity>[]): Promise<(Entity | null)[]>;
    onRemove(data: CircleEntity<Entity>[]): Promise<void>;
    onPostProcess(): Promise<void>;
    private create;
    private apply;
}

declare class CesiumCircleController extends CircleController<Entity> {
    readonly renderer: CesiumCircleOverlayRenderer;
    constructor(renderer: CesiumCircleOverlayRenderer);
}

declare class CesiumPolylineOverlayRenderer implements PolylineOverlayRenderer<Entity> {
    readonly holder: CesiumMapViewHolder;
    constructor(holder: CesiumMapViewHolder);
    onAdd(data: PolylineAddParams[]): Promise<(Entity | null)[]>;
    onChange(data: PolylineChangeParams<Entity>[]): Promise<(Entity | null)[]>;
    onRemove(data: PolylineEntity<Entity>[]): Promise<void>;
    onPostProcess(): Promise<void>;
    private create;
    private apply;
}

declare class CesiumPolylineController extends PolylineController<Entity> {
    readonly renderer: CesiumPolylineOverlayRenderer;
    constructor(renderer: CesiumPolylineOverlayRenderer);
}

declare class CesiumPolygonOverlayRenderer implements PolygonOverlayRenderer<Entity> {
    readonly holder: CesiumMapViewHolder;
    constructor(holder: CesiumMapViewHolder);
    onAdd(data: PolygonAddParams[]): Promise<(Entity | null)[]>;
    onChange(data: PolygonChangeParams<Entity>[]): Promise<(Entity | null)[]>;
    onRemove(data: PolygonEntity<Entity>[]): Promise<void>;
    onPostProcess(): Promise<void>;
    private create;
    private apply;
}

declare class CesiumPolygonController extends PolygonController<Entity> {
    readonly renderer: CesiumPolygonOverlayRenderer;
    constructor(renderer: CesiumPolygonOverlayRenderer);
}

declare class CesiumGroundImageOverlayRenderer implements GroundImageOverlayRenderer<Entity> {
    readonly holder: CesiumMapViewHolder;
    constructor(holder: CesiumMapViewHolder);
    onAdd(data: GroundImageAddParams[]): Promise<(Entity | null)[]>;
    onChange(data: GroundImageChangeParams<Entity>[]): Promise<(Entity | null)[]>;
    onRemove(data: GroundImageEntity<Entity>[]): Promise<void>;
    onPostProcess(): Promise<void>;
    private create;
    private apply;
}

declare class CesiumGroundImageController extends GroundImageController<Entity> {
    readonly renderer: CesiumGroundImageOverlayRenderer;
    constructor(renderer: CesiumGroundImageOverlayRenderer);
}

declare class CesiumRasterLayerOverlayRenderer implements RasterLayerOverlayRenderer<ImageryLayer> {
    readonly holder: CesiumMapViewHolder;
    private readonly zIndexes;
    constructor(holder: CesiumMapViewHolder);
    onAdd(data: RasterLayerAddParams[]): Promise<(ImageryLayer | null)[]>;
    onChange(data: RasterLayerChangeParams<ImageryLayer>[]): Promise<(ImageryLayer | null)[]>;
    onRemove(data: RasterLayerEntity<ImageryLayer>[]): Promise<void>;
    onCameraChanged(_position: MapCameraPosition): Promise<void>;
    onPostProcess(): Promise<void>;
    private create;
}

declare class CesiumRasterLayerController extends RasterLayerController<ImageryLayer> {
    /**
     * headers を持つ Resource を UrlTemplateImageryProvider に渡す。
     *
     * userAgent はブラウザが上書きを許さないので、どのプロバイダでも web では効かない。
     */
    protected get headerSupport(): RasterHeaderSupport;
    readonly renderer: CesiumRasterLayerOverlayRenderer;
    constructor(renderer: CesiumRasterLayerOverlayRenderer);
    composition(data: RasterLayerState[]): Promise<void>;
    update(state: RasterLayerState): Promise<void>;
}

declare class CesiumMapViewController extends BaseMapViewController implements MapViewControllerInterface, MarkerCapable, CircleCapable, PolylineCapable, PolygonCapable, GroundImageCapable, RasterLayerCapable {
    readonly holder: CesiumMapViewHolder;
    private readonly markerController;
    private readonly circleController;
    private readonly polylineController;
    private readonly polygonController;
    private readonly groundImageController;
    private readonly rasterLayerController;
    private readonly eventHelper;
    private readonly input;
    private destroyed;
    private initialized;
    private isCameraMoving;
    private activeMarkerDrag;
    private suppressNextClick;
    private logicalTiltHint;
    constructor(holder: CesiumMapViewHolder, markerController: CesiumMarkerController, circleController: CesiumCircleController, polylineController: CesiumPolylineController, polygonController: CesiumPolygonController, groundImageController: CesiumGroundImageController, rasterLayerController: CesiumRasterLayerController);
    getMap(): Viewer;
    /**
     * Cesium's camera controller names its inputs after what they do to the
     * globe, not after the map gesture: in 3D a left drag *rotates* the globe,
     * which is what MapConductor calls scrolling.
     *
     * Heading and pitch share one input (`enableTilt` — a middle or ctrl drag
     * changes both), so rotate and tilt can only be switched off together. The
     * gesture left on is reported when the two flags disagree.
     */
    applyUISettings(settings: MapUISettings): void;
    private setupEvents;
    private handleClick;
    private dispatchOverlayClick;
    private handleMarkerDragDown;
    private dragAnchorPosition;
    private handleMarkerDragMove;
    private handleMarkerDragUp;
    private restoreCameraInputs;
    setMapInitializedListener(listener: OnMapInitializedHandler | null): void;
    moveCamera(position: MapCameraPosition): Promise<boolean>;
    animateCamera(position: MapCameraPosition, durationMillis: number): Promise<boolean>;
    /**
     * Shared camera commit. `snapZoom` defaults to true so explicit camera targets
     * quantize their zoom to match the Google Maps 2D reference; fitBounds passes
     * false to keep its fractional fit zoom (otherwise `padding` has no effect).
     */
    private applyCamera;
    fitBounds(bounds: GeoRectBounds, padding: number): Promise<boolean>;
    getCameraPosition(): MapCameraPosition;
    private getVisibleRegion;
    /**
     * カメラの向きを入れ直す。**`lookAt` / `flyToBoundingSphere` だけでは bearing が効かない。**
     *
     * どちらも向きを `HeadingPitchRange` で受け取るが、Cesium はその offset から
     * `right = cross(direction, UNIT_Z)` で右方向を作る。pitch がちょうど -90 度
     * （真上から見下ろす）だと direction が -Z になって外積がゼロになり、heading と
     * 無関係な固定軸（`UNIT_X`）へフォールバックする。つまり **tilt 0 のとき heading が
     * 丸ごと落ちて、bearing をいくつにしても常に北が上のまま描かれる。**
     * tilt 0 は既定値なので、実質ほぼ全てのカメラが該当していた。
     *
     * 位置は `lookAt` が正しく置く（pitch -90 では heading に依らず真上に来る）ので、
     * ここでは位置をそのままに向きだけを `setView` で入れ直す。`setView` の
     * heading/pitch/roll は ENU フレームの回転として定義されていて pitch ±90 でも
     * 縮退しない。pitch が -90 以外のときは同じ向きを入れ直すだけの no-op になる。
     */
    private applyCameraOrientation;
    private orbitCamera;
    private notifyControllersCameraChanged;
    setOnMarkerClickListener(value: OnMarkerEventHandler | null): void;
    setOnMarkerDragStart(value: OnMarkerEventHandler | null): void;
    setOnMarkerDrag(value: OnMarkerEventHandler | null): void;
    setOnMarkerDragEnd(value: OnMarkerEventHandler | null): void;
    setOnMarkerAnimateStart(value: OnMarkerEventHandler | null): void;
    setOnMarkerAnimateEnd(value: OnMarkerEventHandler | null): void;
    setMarkerAnimationOverlayHost(host: MarkerAnimationOverlayHost | null): void;
    clearOverlays(): Promise<void>;
    destroy(): void;
    /**
     * マーカーのヒットテストと配送。カスケードの先頭。
     *
     * タイル方式のマーカーはラスターオーバーレイに描かれ、`scene.pick` に載らないので
     * ここでヒットテストする。通常のマーカーは pick 経路で先に処理される。
     */
    protected dispatchMarkerTap(clicked: GeoPoint): boolean;
}

interface CesiumConfig extends MapConfig {
    mapDesignType: CesiumMapDesignType;
    options?: NonNullable<ConstructorParameters<typeof Viewer>[1]>;
    markerTilingOptions?: MarkerTilingOptions;
    minZoom?: number;
    maxZoom?: number;
    /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
    restrictBounds?: GeoRectBounds;
}

declare class CesiumProvider extends MapProvider {
    private viewer;
    private resizeObserver;
    initialize(config: CesiumConfig): Promise<MapViewControllerInterface>;
    destroy(): void;
}

type CesiumActualMarker = Entity;
type CesiumActualCircle = Entity;
type CesiumActualPolyline = Entity;
type CesiumActualPolygon = Entity;
type CesiumActualGroundImage = Entity;
type CesiumActualRasterLayer = ImageryLayer;

export { type CesiumActualCircle, type CesiumActualGroundImage, type CesiumActualMarker, type CesiumActualPolygon, type CesiumActualPolyline, type CesiumActualRasterLayer, CesiumCircleController, CesiumCircleOverlayRenderer, type CesiumConfig, CesiumDesign, type CesiumDesignParams, CesiumGroundImageController, CesiumGroundImageOverlayRenderer, type CesiumMapDesignType, CesiumProvider as CesiumMapProvider, CesiumMapView, CesiumMapViewController, CesiumMapViewHolder, type CesiumMapViewProps, CesiumMapViewState, type CesiumMapViewStateInterface, type CesiumMapViewStateParams, CesiumMarkerController, CesiumMarkerRenderer, type CesiumMarkerRendererInterface, CesiumPolygonController, CesiumPolygonOverlayRenderer, CesiumPolylineController, CesiumPolylineOverlayRenderer, CesiumProvider, CesiumRasterLayerController, CesiumRasterLayerOverlayRenderer, ZoomAltitudeConverter, type ZoomAltitudeViewportSize, useCesiumMapViewState };
