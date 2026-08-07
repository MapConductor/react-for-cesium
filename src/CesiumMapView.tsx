import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  InfoBubbleOverlay,
  MapAttributionOverlay,
  MapContext,
  MapViewScope,
  MapServiceRegistryProvider,
  MapViewScopeProvider,
  MarkerAnimationLayer,
  type InfoBubbleEntry,
  createMapContextValue,
} from '@mapconductor/js-sdk-react';
import {
  useCameraRestriction,
  useMapUISettings,
  useMarkerRenderingSupport,
} from '@mapconductor/js-sdk-react/internal';
import { type GeoPoint, type MapCameraPosition, type MarkerAnimationOverlayEntry, type OverlayCollector, mapViewStateInternal } from '@mapconductor/js-sdk-core';
import { CesiumProvider } from './CesiumProvider';
import type { CesiumConfig } from './CesiumMapConfig';
import type { CesiumMapViewController } from './CesiumMapViewController';
import type { CesiumMapViewProps } from './CesiumMapViewProps';

export function CesiumMapView({ state, onMapLoaded, onMapClick, onMapLongClick, onCameraMoveStart, onCameraMove, onCameraMoveEnd, className, containerStyle, options, onError, children, markerTilingOptions, minZoom, maxZoom, restrictBounds, cameraRestriction }: CesiumMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [provider] = useState(() => new CesiumProvider());
  const [scope] = useState(() => new MapViewScope());
  const [controller, setController] = useState<CesiumMapViewController | null>(null);
  const [isReady, setIsReady] = useState(false);
  // `onMapLoaded` と同じ瞬間を「値」として持つ。イベントを取り逃した後から
  // マウントした子（examples の Three.js overlay 等）も読めるようにするため。
  const [isLoaded, setIsLoaded] = useState(false);
  const bridgeUnsubs = useRef<(() => void)[]>([]);
  const [bubbleEntries, setBubbleEntries] = useState<InfoBubbleEntry[]>([]);
  const [animationEntries, setAnimationEntries] = useState<MarkerAnimationOverlayEntry[]>([]);
  const [, setCameraTick] = useState(0);
  const callbacks = useRef({ onMapLoaded, onMapClick, onMapLongClick, onCameraMoveStart, onCameraMove, onCameraMoveEnd, onError });
  callbacks.current = { onMapLoaded, onMapClick, onMapLongClick, onCameraMoveStart, onCameraMove, onCameraMoveEnd, onError };

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    setIsReady(false);
    setIsLoaded(false);
    const config: CesiumConfig = { container: containerRef.current, initCameraPosition: state.cameraPosition, mapDesignType: state.mapDesignType, options, markerTilingOptions, minZoom, maxZoom, restrictBounds };
    provider.initialize(config).then(raw => {
      if (cancelled) return;
      const ctrl = raw as CesiumMapViewController;
      mapViewStateInternal(state).setController(ctrl); setController(ctrl);
      mapViewStateInternal(state).setCameraPositionChangeListener(() => setCameraTick(t => t + 1));
      ctrl.setCameraMoveStartListener((camera: MapCameraPosition) => { mapViewStateInternal(state).updateCameraPosition(camera); callbacks.current.onCameraMoveStart?.(camera); });
      ctrl.setCameraMoveListener((camera: MapCameraPosition) => { mapViewStateInternal(state).updateCameraPosition(camera); callbacks.current.onCameraMove?.(camera); setCameraTick(t => t + 1); });
      ctrl.setCameraMoveEndListener((camera: MapCameraPosition) => { mapViewStateInternal(state).updateCameraPosition(camera); callbacks.current.onCameraMoveEnd?.(camera); setCameraTick(t => t + 1); });
      ctrl.setMapClickListener((point: GeoPoint) => callbacks.current.onMapClick?.(point));
      ctrl.setMapLongClickListener((point: GeoPoint) => callbacks.current.onMapLongClick?.(point));
      ctrl.setMapInitializedListener(() => {
          // 地図が出来た時点の実カメラ（visibleRegion 込み）を state へ流し込む。
          // これで `mapViewState.cameraPosition` が最初から権威ある値になり、
          // 拡張モジュールが `cameraPosition.visibleRegion.bounds` を初回から読める。
          const initial = ctrl.getCameraPosition();
          if (initial) mapViewStateInternal(state).updateCameraPosition(initial);
          setIsLoaded(true);
          callbacks.current.onMapLoaded?.(state);
        });
      for (const overlay of scope.buildRegistry().getAll()) bridgeUnsubs.current.push(overlay.subscribe(data => { overlay.render(data, ctrl).catch(console.error); }));
      bridgeUnsubs.current.push(scope.bubbleCollector.subscribe(entries => setBubbleEntries(Array.from(entries.values()))));
      ctrl.setMarkerAnimationOverlayHost(scope.markerAnimationStore.start);
      bridgeUnsubs.current.push(() => ctrl.setMarkerAnimationOverlayHost(null));
      bridgeUnsubs.current.push(scope.markerAnimationStore.subscribe(setAnimationEntries));
      const capable = ctrl as unknown as Record<string, (state: never) => unknown>;
      const setup = <S extends { id: string }>(collector: OverlayCollector<S>, hasMethod: string, updateMethod: string, onUpdated?: () => void) => {
        collector.setUpdateHandler(next => {
          if ((capable[hasMethod] as (value: S) => boolean)?.(next)) {
            void (capable[updateMethod] as (value: S) => Promise<void>)?.(next);
            onUpdated?.();
          }
        });
        bridgeUnsubs.current.push(() => collector.setUpdateHandler(null));
      };
      setup(scope.markerCollector, 'hasMarker', 'updateMarker', () => setCameraTick(t => t + 1)); setup(scope.circleCollector, 'hasCircle', 'updateCircle');
      setup(scope.polylineCollector, 'hasPolyline', 'updatePolyline'); setup(scope.polygonCollector, 'hasPolygon', 'updatePolygon');
      setup(scope.groundImageCollector, 'hasGroundImage', 'updateGroundImage'); setup(scope.rasterLayerCollector, 'hasRasterLayer', 'updateRasterLayer');
      setIsReady(true);
    }).catch(reason => { if (!cancelled) callbacks.current.onError?.(reason instanceof Error ? reason : new Error(String(reason))); });

    return () => { cancelled = true; mapViewStateInternal(state).setCameraPositionChangeListener(null); mapViewStateInternal(state).setController(null); bridgeUnsubs.current.forEach(fn => fn()); bridgeUnsubs.current = []; provider.destroy(); };
  }, [markerTilingOptions, minZoom, maxZoom, restrictBounds, options, provider, scope, state, state.mapDesignType.id]);

  useMapUISettings(state, controller);
  // マップ生成時 config だけでなく、prop の変化にも追随させる（android-sdk 相当）。
  useCameraRestriction(controller, { cameraRestriction, restrictBounds, minZoom, maxZoom });
  // マーカー描画 capability をこのマップのサービスレジストリへ登録する。
  // marker-clustering などの拡張がここから解決する
  // （android-sdk の *MapView.kt / ios-sdk の *MapView.swift が
  //  MarkerRenderingSupportKey を put するのと同じ位置づけ）。
  useMarkerRenderingSupport(state, scope, controller);

  return <MapContext.Provider value={createMapContextValue({ controller, isReady, isLoaded, state })}>
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...containerStyle }}>
      <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
      {controller && <MapAttributionOverlay scope={scope} camera={state.cameraPosition} designAttributionRules={state.mapDesignType.attributionRules} />}
      {animationEntries.length > 0 && controller && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <MarkerAnimationLayer entries={animationEntries} resolveScreenOffset={entry => controller.holder.toScreenOffset(entry.state.position)} />
      </div>}
      {bubbleEntries.length > 0 && controller && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>{bubbleEntries.map(entry => {
        const icon = entry.icon; const size = icon ? icon.iconSize * icon.scale : 0;
        return <InfoBubbleOverlay key={entry.id} positionOffset={controller.holder.toScreenOffset(entry.positionProvider()) ?? { x: -10000, y: -10000 }} iconSize={{ width: size, height: size }} iconOffset={icon?.anchor ?? { x: 0.5, y: 0.5 }} infoAnchorOffset={icon?.infoAnchor ?? { x: 0.5, y: 0.5 }} tailOffset={entry.tailOffset} style={{ pointerEvents: 'auto' }}>{entry.content as ReactNode}</InfoBubbleOverlay>;
      })}</div>}
    </div>
    <MapServiceRegistryProvider registry={state.serviceRegistry}>
      <MapViewScopeProvider scope={scope}>{children}</MapViewScopeProvider>
    </MapServiceRegistryProvider>
  </MapContext.Provider>;
}
