export type CesiumOverlayKind = 'marker' | 'circle' | 'polyline' | 'polygon' | 'ground-image';

export function cesiumEntityId(kind: CesiumOverlayKind, stateId: string): string {
  return `mapconductor:${kind}:${stateId}`;
}

export function parseCesiumEntityId(value: string): { kind: CesiumOverlayKind; stateId: string } | null {
  const match = /^mapconductor:(marker|circle|polyline|polygon|ground-image):(.*)$/.exec(value);
  return match ? { kind: match[1] as CesiumOverlayKind, stateId: match[2] } : null;
}
