import type { AttributionRule, MapDesignTypeInterface } from '@mapconductor/js-sdk-core';
import { OpenStreetMapImageryProvider, type ImageryProvider } from 'cesium';

export interface CesiumMapDesignType extends MapDesignTypeInterface<string> {
  readonly imageryProvider: ImageryProvider | null;
}

export interface CesiumDesignParams {
  id: string;
  imageryProvider?: ImageryProvider | null;
  attributionRules?: readonly AttributionRule[];
}

export class CesiumDesign implements CesiumMapDesignType {
  readonly id: string;
  readonly imageryProvider: ImageryProvider | null;
  readonly attributionRules: readonly AttributionRule[];

  constructor({ id, imageryProvider = null, attributionRules = [] }: CesiumDesignParams) {
    this.id = id;
    this.imageryProvider = imageryProvider;
    this.attributionRules = attributionRules;
  }

  getValue(): string { return this.id; }

  static readonly Default = new CesiumDesign({
    id: 'openstreetmap',
    imageryProvider: new OpenStreetMapImageryProvider({
      url: 'https://tile.openstreetmap.org/',
    }),
    attributionRules: [{
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }],
  });
  static readonly None = new CesiumDesign({ id: 'none' });
}
