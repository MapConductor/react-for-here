import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeoPoint, createGeoRectBounds, createGroundImageState } from '@mapconductor/js-sdk-core';
import { createFakeMap, installFakeHere, installFakeImage } from './support/fakeHere.mjs';
import { buildSources } from './support/buildSources.mjs';

// GroundImage は H.map.Overlay で描き、地図の object レイヤーではなく専用の
// ObjectLayer（map.getLayers() のラスターの上）に入れる。矩形の向き
// （H.geo.Rect は top, left, bottom, right）、不透明度、範囲・画像・不透明度の
// その場更新、作り直さないこと、専用レイヤーは 1 枚だけ作ることを確かめる。
installFakeHere();
installFakeImage();
const { controller, renderer } = await buildSources('ground-image-tests', {
    controller: 'src/groundimage/HereGroundImageController.ts',
    renderer: 'src/groundimage/HereGroundImageOverlayRenderer.ts',
});
const { HereGroundImageController } = controller;
const { HereGroundImageOverlayRenderer } = renderer;

function fixture() {
    const map = createFakeMap();
    const ctrl = new HereGroundImageController(new HereGroundImageOverlayRenderer({ map }));
    const objectLayers = () => map.layers.filter((l) => l.kind === 'object');
    const overlays = () => objectLayers().flatMap((l) => l.provider.getRootGroup().objects);
    return { map, controller: ctrl, objectLayers, overlays };
}

function bounds(south, west, north, east) {
    const b = createGeoRectBounds();
    b.extend(createGeoPoint({ latitude: south, longitude: west }));
    b.extend(createGeoPoint({ latitude: north, longitude: east }));
    return b;
}

const image = (overrides = {}) => createGroundImageState({
    id: 'g', bounds: bounds(10, 20, 11, 22), imageUrl: 'https://example.com/a.png', opacity: 0.7, ...overrides,
});
const rectOf = (overlay) => ({ top: overlay.rect.top, left: overlay.rect.left, bottom: overlay.rect.bottom, right: overlay.rect.right });

test('a ground image is an H.map.Overlay in its own object layer, off the map object list', async () => {
    const f = fixture();
    await f.controller.composition([image()]);
    assert.equal(f.map.objects.length, 0);
    assert.equal(f.objectLayers().length, 1);
    const [overlay] = f.overlays();
    assert.deepEqual(rectOf(overlay), { top: 11, left: 20, bottom: 10, right: 22 });
    assert.equal(overlay.opacity, 0.7);
    assert.equal(overlay.data, 'g');
    assert.equal(overlay.bitmap.src, 'https://example.com/a.png');
    assert.equal(overlay.bitmap.crossOrigin, 'anonymous');
});

test('every ground image shares one object layer', async () => {
    const f = fixture();
    await f.controller.composition([image(), image({ id: 'h', imageUrl: 'https://example.com/b.png' })]);
    assert.equal(f.objectLayers().length, 1);
    assert.equal(f.overlays().length, 2);
});

test('bounds, image and opacity are changed on the same overlay', async () => {
    const f = fixture();
    await f.controller.composition([image()]);
    const [overlay] = f.overlays();
    await f.controller.composition([image({ opacity: 0.2 })]);
    assert.equal(overlay.opacity, 0.2);
    await f.controller.composition([image({ opacity: 0.2, bounds: bounds(-5, -6, 5, 6) })]);
    assert.deepEqual(rectOf(overlay), { top: 5, left: -6, bottom: -5, right: 6 });
    await f.controller.composition([image({ opacity: 0.2, bounds: bounds(-5, -6, 5, 6), imageUrl: 'https://example.com/c.png' })]);
    assert.equal(overlay.bitmap.src, 'https://example.com/c.png');
    assert.deepEqual(f.overlays(), [overlay]);
});

test('removing a ground image takes its overlay out of the layer', async () => {
    const f = fixture();
    await f.controller.composition([image(), image({ id: 'h' })]);
    await f.controller.composition([image({ id: 'h' })]);
    assert.deepEqual(f.overlays().map((o) => o.data), ['h']);
    await f.controller.clear();
    assert.equal(f.overlays().length, 0);
});
