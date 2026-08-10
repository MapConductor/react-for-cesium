import {
  useState } from 'react';
import {
  MapCameraPosition as MapCameraPositionNS,
  MapViewState,
  createRandomId,
  type MapCameraPosition,
  type MapViewControllerInterface,
  type MapViewStateInterface,
} from '@mapconductor/js-sdk-core';
import { CesiumDesign, type CesiumMapDesignType } from './CesiumDesign';

export interface CesiumMapViewStateInterface extends MapViewStateInterface<CesiumMapDesignType> {}
export interface CesiumMapViewStateParams { id?: string; mapDesignType?: CesiumMapDesignType; cameraPosition?: MapCameraPosition; }

export class CesiumMapViewState extends MapViewState<CesiumMapDesignType> implements CesiumMapViewStateInterface {
  private _mapDesignType: CesiumMapDesignType;

  constructor({ id = createRandomId(), mapDesignType = CesiumDesign.Default, cameraPosition = MapCameraPositionNS.Default }: CesiumMapViewStateParams = {}) {
    super({ id, cameraPosition });
    this._mapDesignType = mapDesignType;
  }

  override get mapDesignType(): CesiumMapDesignType {
    return this._mapDesignType;
  }

  override set mapDesignType(value: CesiumMapDesignType) {
    this._mapDesignType = value;
  }

  /** このプロバイダは接続時にカメラを動かさない（ビュー側が別経路で初期位置を当てる）。 */
  override setController(controller: MapViewControllerInterface | null): void {
    this.attachController(controller, false);
  }
}
export function useCesiumMapViewState(params: CesiumMapViewStateParams = {}): CesiumMapViewStateInterface {
  const [state] = useState(() => new CesiumMapViewState(params)); return state;
}
