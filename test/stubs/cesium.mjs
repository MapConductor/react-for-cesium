// Minimal stand-in for 'cesium' that records what the polygon renderer builds.
export const ArcType = { NONE: 'NONE', GEODESIC: 'GEODESIC', RHUMB: 'RHUMB' };
export class Color { static WHITE = new Color(); static fromCssColorString() { return new Color(); } }
export const Cartesian3 = { fromDegreesArray: (degrees) => [...degrees] };
export class Cartesian2 {}
export class Cartographic {}
export const SceneTransforms = {};
const CesiumMath = {};
export { CesiumMath as Math };
export class Entity { constructor(options) { Object.assign(this, options); } }
export class PolygonHierarchy { constructor(positions, holes = []) { this.positions = positions; this.holes = holes; } }
export class PolygonGraphics { constructor(options) { Object.assign(this, options); } }
export class PolylineGraphics { constructor(options) { Object.assign(this, options); } }
