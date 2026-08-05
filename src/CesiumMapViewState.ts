import { useState } from 'react';
import {
  MapCameraPosition as MapCameraPositionNS,
  MapViewState,
  createRandomId,
  type GeoPoint,
  type MapCameraPosition,
  type MapViewControllerInterface,
  type GeoRectBounds,
  type MapViewHolder,
  type MapViewStateInterface,
} from '@mapconductor/js-sdk-core';
import { CesiumDesign, type CesiumMapDesignType } from './CesiumDesign';

export interface CesiumMapViewStateInterface extends MapViewStateInterface<CesiumMapDesignType> {}
export interface CesiumMapViewStateParams { id?: string; mapDesignType?: CesiumMapDesignType; cameraPosition?: MapCameraPosition; }

export class CesiumMapViewState extends MapViewState<CesiumMapDesignType> implements CesiumMapViewStateInterface {
  readonly id: string;
  private _cameraPosition: MapCameraPosition;
  private _mapDesignType: CesiumMapDesignType;
  private _controller: MapViewControllerInterface | null = null;
  private _cameraPositionChangeListener: ((camera: MapCameraPosition) => void) | null = null;

  constructor({ id = createRandomId(), mapDesignType = CesiumDesign.Default, cameraPosition = MapCameraPositionNS.Default }: CesiumMapViewStateParams = {}) {
    super(); this.id = id; this._cameraPosition = cameraPosition; this._mapDesignType = mapDesignType;
  }
  override get cameraPosition(): MapCameraPosition { return this._cameraPosition; }
  override get mapDesignType(): CesiumMapDesignType { return this._mapDesignType; }
  override set mapDesignType(value: CesiumMapDesignType) { this._mapDesignType = value; }
  override moveCameraTo(position: GeoPoint, durationMillis?: number): void;
  override moveCameraTo(cameraPosition: MapCameraPosition, durationMillis?: number): void;
  override moveCameraTo(value: GeoPoint | MapCameraPosition, durationMillis?: number): void {
    const next = 'zoom' in value ? this.resolveCameraPosition(value) : this._cameraPosition.copy({ position: value });
    if (this._controller) {
      if (durationMillis) void this._controller.animateCamera(next, { duration: durationMillis });
      else void this._controller.moveCamera(next);
    }
    this._cameraPosition = next; this._cameraPositionChangeListener?.(next);
  }
  override getMapViewHolder(): MapViewHolder<unknown, unknown> | null { return this._controller?.holder ?? null; }
  override fitBounds(bounds: GeoRectBounds, padding: number = 0): void { void this._controller?.fitBounds(bounds, { padding }); }
  setController(controller: MapViewControllerInterface | null): void { this._controller = controller; }
  updateCameraPosition(camera: MapCameraPosition): void { this._cameraPosition = camera; this._cameraPositionChangeListener?.(camera); }
  setCameraPositionChangeListener(listener: ((camera: MapCameraPosition) => void) | null): void { this._cameraPositionChangeListener = listener; }
  private resolveCameraPosition(target: MapCameraPosition): MapCameraPosition {
    return target.zoom === 0 && target.bearing === 0 && target.tilt === 0 ? this._cameraPosition.copy({ position: target.position }) : target;
  }
}
export function useCesiumMapViewState(params: CesiumMapViewStateParams = {}): CesiumMapViewState {
  const [state] = useState(() => new CesiumMapViewState(params)); return state;
}
