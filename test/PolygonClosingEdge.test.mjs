import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'tsup';
import { createGeoPoint, createPolygonState } from '@mapconductor/js-sdk-core';

// The fill and the outline of a polygon must trace the same line, closing edge
// (last vertex -> first) included, in both geodesic modes. Cesium is replaced
// by a stub that records the graphics the renderer builds.
mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const outDir = mkdtempSync(new URL('../build/polygon-closing-edge-tests-', import.meta.url));
after(() => rmSync(outDir, { recursive: true, force: true }));
const cesiumStub = fileURLToPath(new URL('./stubs/cesium.mjs', import.meta.url));
await build({
    entry: { renderer: 'src/polygon/CesiumPolygonOverlayRenderer.ts' },
    outDir, format: ['esm'], platform: 'node', splitting: false,
    dts: false, sourcemap: false, config: false, silent: true,
    external: ['@mapconductor/js-sdk-core'],
    noExternal: ['cesium'],
    esbuildOptions(options) { options.alias = { cesium: cesiumStub }; },
});
const { CesiumPolygonOverlayRenderer } = await import(pathToFileURL(resolve(outDir, 'renderer.mjs')));

const p = (latitude, longitude) => createGeoPoint({ latitude, longitude });
const BOSTON = p(42.36, -71.06);
const LONDON = p(51.5, -0.12);
const ICELAND = p(64.1, -21.9);
const TRIANGLE = [BOSTON, LONDON, ICELAND];

async function render(geodesic) {
    const entities = [];
    const holder = {
        isDestroyed: () => false,
        map: { entities: { add: (entity) => (entities.push(entity), entity) }, scene: { requestRender() {} } },
    };
    const state = createPolygonState({
        id: 'tri', points: TRIANGLE, geodesic, strokeWidth: 2, strokeColor: '#000', fillColor: '#f00',
    });
    await new CesiumPolygonOverlayRenderer(holder).onAdd([{ state }]);
    return entities[0];
}

/** [lon, lat, lon, lat, ...] -> [[lon, lat], ...] */
const pairs = (degrees) => degrees.reduce((acc, v, i) => (i % 2 ? acc[acc.length - 1].push(v) : acc.push([v]), acc), []);

for (const geodesic of [true, false]) {
    test(`geodesic=${geodesic}: fill and outline use the same vertices and arc type`, async () => {
        const entity = await render(geodesic);
        const fill = pairs(entity.polygon.hierarchy.positions);
        const outline = pairs(entity.polyline.positions);
        // The outline is the fill ring closed with its first vertex.
        assert.deepEqual(outline.slice(0, -1), fill);
        assert.deepEqual(outline[outline.length - 1], fill[0]);
        assert.equal(entity.polyline.arcType, entity.polygon.arcType);
    });
}

test('geodesic=false: the closing edge is densified along the lat/lng line', async () => {
    const fill = pairs((await render(false)).polygon.hierarchy.positions);
    // Halfway along Iceland -> Boston the linear edge passes 53.23N at 46.48W.
    const midLng = (ICELAND.longitude + BOSTON.longitude) / 2;
    const midLat = (ICELAND.latitude + BOSTON.latitude) / 2;
    const nearest = Math.min(...fill.map(([lng, lat]) => Math.hypot(lat - midLat, lng - midLng)));
    assert.ok(nearest < 0.1, `nearest ${nearest}`);
});

test('geodesic=true: the closing edge is densified along the great circle', async () => {
    const fill = pairs((await render(true)).polygon.hierarchy.positions);
    // Iceland -> Boston passes 55.6N at 53.2W (the undensified edge stays about 4 degrees away).
    // Geodesic rings are densified every 100 km, so allow half a segment.
    const nearest = Math.min(...fill.map(([lng, lat]) => Math.hypot(lat - 55.63, lng + 53.17)));
    assert.ok(nearest < 1, `nearest ${nearest}`);
});
