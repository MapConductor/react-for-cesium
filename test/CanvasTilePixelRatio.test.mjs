import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'tsup';

// Marker tiles follow the ratio Cesium draws its canvas at, not the display's:
// by default Cesium ignores devicePixelRatio, and a 2x tile would be shrunk.
mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const outDir = mkdtempSync(new URL('../build/canvas-tile-pixel-ratio-tests-', import.meta.url));
after(() => rmSync(outDir, { recursive: true, force: true }));
await build({
    entry: { ratio: 'src/marker/canvasTilePixelRatio.ts' },
    outDir, format: ['esm'], platform: 'node', splitting: false,
    dts: false, sourcemap: false, config: false, silent: true,
    external: ['@mapconductor/js-sdk-core'],
});
const { canvasTilePixelRatio } = await import(pathToFileURL(resolve(outDir, 'ratio.mjs')));

const viewer = (useBrowserRecommendedResolution, resolutionScale = 1) =>
    ({ useBrowserRecommendedResolution, resolutionScale });

test("Cesium's default canvas is 1x on any display, so tiles stay 1x", () => {
    assert.equal(canvasTilePixelRatio(viewer(true), 2), 1);
    assert.equal(canvasTilePixelRatio(viewer(true), 3), 1);
});

test('a canvas drawn at the display ratio gets tiles at that ratio, capped at 2', () => {
    assert.equal(canvasTilePixelRatio(viewer(false), 1), 1);
    assert.equal(canvasTilePixelRatio(viewer(false), 1.5), 2);
    assert.equal(canvasTilePixelRatio(viewer(false), 2), 2);
    assert.equal(canvasTilePixelRatio(viewer(false), 3), 2);
});

test('resolutionScale scales the canvas, and so the tiles', () => {
    assert.equal(canvasTilePixelRatio(viewer(true, 2), 1), 2);
    assert.equal(canvasTilePixelRatio(viewer(false, 0.5), 2), 1);
    assert.equal(canvasTilePixelRatio(viewer(false, 1), undefined), 1);
});
