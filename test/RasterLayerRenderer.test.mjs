import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createRasterLayerState,
    RasterLayerSource,
    TileScheme,
    POLYGON_TILE_LAYER_ID,
    POLYLINE_TILE_LAYER_ID,
    CIRCLE_TILE_LAYER_ID,
} from '@mapconductor/js-sdk-core';
import { createFakeMap, installFakeHere } from './support/fakeHere.mjs';
import { buildSources } from './support/buildSources.mjs';

// ラスターレイヤーを、地図だけ偽物にして実際のコントローラ＋レンダラーで動かす。
// URL テンプレート（x の折り返し、TMS の y 反転、ArcGIS のパス）、不透明度は
// プロバイダ側に載せてその場で変えること、表示切替で付け外しすること、
// ソースが変わったら新しいレイヤーを先に足してから古いのを外すこと、
// map.getLayers() の中の重なり順（ベース < ラスター(zIndex 順) < GroundImage
// < ポリゴン/サークル/ポリラインのタイル < マーカーのタイル）を確かめる。
installFakeHere();
const { controller, renderer, helpers } = await buildSources('raster-tests', {
    controller: 'src/raster/HereRasterLayerController.ts',
    renderer: 'src/raster/HereRasterLayerOverlayRenderer.ts',
    helpers: 'src/helpers.ts',
});
const { HereRasterLayerController } = controller;
const { HereRasterLayerOverlayRenderer } = renderer;
const { addStackedLayer, spatialStackZIndex } = helpers;

function fixture({ baseLayers = [] } = {}) {
    const map = createFakeMap({ baseLayers });
    const holder = { map };
    const ctrl = new HereRasterLayerController(new HereRasterLayerOverlayRenderer(holder));
    return { map, controller: ctrl, tileLayers: () => map.layers.filter((l) => l.kind === 'tile') };
}

const xyz = (overrides = {}) => RasterLayerSource.UrlTemplate({
    template: 'https://tiles.example.com/{z}/{x}/{y}.png',
    ...overrides,
});

test('a URL template becomes an ImageTileProvider with the source options', async () => {
    const f = fixture();
    await f.controller.composition([createRasterLayerState({
        id: 'osm', source: xyz({ tileSize: 512, minZoom: 2, maxZoom: 18 }), opacity: 0.4,
    })]);
    assert.equal(f.tileLayers().length, 1);
    const provider = f.tileLayers()[0].getProvider();
    assert.equal(provider.options.tileSize, 512);
    assert.equal(provider.options.min, 2);
    assert.equal(provider.options.max, 18);
    assert.equal(provider.options.opacity, 0.4);
    assert.equal(provider.getURL(3, 5, 4), 'https://tiles.example.com/4/3/5.png');
});

test('defaults: 256px tiles and no zoom limits', async () => {
    const f = fixture();
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz() })]);
    const { options } = f.tileLayers()[0].getProvider();
    assert.equal(options.tileSize, 256);
    assert.equal(options.min, undefined);
    assert.equal(options.max, undefined);
    assert.equal(options.opacity, 1);
});

test('x wraps around the world and TMS flips y', async () => {
    const f = fixture();
    await f.controller.composition([
        createRasterLayerState({ id: 'xyz', source: xyz() }),
        createRasterLayerState({ id: 'tms', source: xyz({ scheme: TileScheme.TMS }) }),
    ]);
    const [plain, tms] = f.tileLayers().map((l) => l.getProvider());
    assert.equal(plain.getURL(-1, 0, 2), 'https://tiles.example.com/2/3/0.png');
    assert.equal(plain.getURL(9, 1, 3), 'https://tiles.example.com/3/1/1.png');
    assert.equal(tms.getURL(1, 0, 2), 'https://tiles.example.com/2/1/3.png');
    assert.equal(tms.getURL(0, 0, 0), 'https://tiles.example.com/0/0/0.png');
});

test('an ArcGIS service URL drops trailing slashes and uses z/y/x', async () => {
    const f = fixture();
    await f.controller.composition([createRasterLayerState({
        id: 'esri', source: RasterLayerSource.ArcGisService('https://server.example.com/MapServer//'),
    })]);
    assert.equal(f.tileLayers()[0].getProvider().getURL(7, 9, 5),
        'https://server.example.com/MapServer/tile/5/9/7');
});

test('a TileJSON source is not drawn on the web', async () => {
    const f = fixture();
    await f.controller.composition([createRasterLayerState({
        id: 'tj', source: RasterLayerSource.TileJson('https://example.com/tiles.json'),
    })]);
    assert.equal(f.tileLayers().length, 0);
    assert.equal(f.controller.hasId?.('tj') ?? false, false);
});

test('opacity changes in place on the provider and is clamped to 0..1', async () => {
    const f = fixture();
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz(), opacity: 1 })]);
    const layer = f.tileLayers()[0];
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz(), opacity: 0.25 })]);
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz(), opacity: 3 })]);
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz(), opacity: -1 })]);
    assert.deepEqual(layer.getProvider().opacityCalls, [0.25, 1, 0]);
    assert.deepEqual(f.tileLayers(), [layer], 'the layer was not recreated');
});

test('an opacity out of range is clamped when the provider is built', async () => {
    const f = fixture();
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz(), opacity: 2 })]);
    assert.equal(f.tileLayers()[0].getProvider().options.opacity, 1);
});

test('visible: false keeps the layer off the map until it is shown', async () => {
    const f = fixture();
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz(), visible: false })]);
    assert.equal(f.tileLayers().length, 0);
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz(), visible: true })]);
    assert.equal(f.tileLayers().length, 1);
    const shown = f.tileLayers()[0];
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz(), visible: false })]);
    assert.equal(f.tileLayers().length, 0);
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz(), visible: true })]);
    assert.deepEqual(f.tileLayers(), [shown], 'the same layer comes back');
});

test('a new source is attached before the old layer is removed', async () => {
    const f = fixture();
    await f.controller.composition([createRasterLayerState({ id: 'a', source: xyz() })]);
    const old = f.tileLayers()[0];
    const seen = [];
    const addLayer = f.map.addLayer.bind(f.map);
    const removeLayer = f.map.removeLayer.bind(f.map);
    f.map.addLayer = (layer, index) => { seen.push(['add', f.map.layers.includes(old)]); addLayer(layer, index); };
    f.map.removeLayer = (layer) => { seen.push(['remove', layer === old]); removeLayer(layer); };
    await f.controller.composition([createRasterLayerState({
        id: 'a', source: xyz({ template: 'https://other.example.com/{z}/{x}/{y}.png' }),
    })]);
    assert.deepEqual(seen, [['add', true], ['remove', true]]);
    assert.equal(f.tileLayers().length, 1);
    assert.equal(f.tileLayers()[0].getProvider().getURL(0, 0, 0), 'https://other.example.com/0/0/0.png');
});

test('removing a layer from the list takes it off the map', async () => {
    const f = fixture();
    await f.controller.composition([
        createRasterLayerState({ id: 'a', source: xyz() }),
        createRasterLayerState({ id: 'b', source: xyz({ template: 'https://b/{z}/{x}/{y}' }) }),
    ]);
    await f.controller.composition([createRasterLayerState({ id: 'b', source: xyz({ template: 'https://b/{z}/{x}/{y}' }) })]);
    assert.equal(f.tileLayers().length, 1);
    assert.equal(f.tileLayers()[0].getProvider().getURL(0, 0, 0), 'https://b/0/0/0');
});

test('layers stack by kind and zIndex whatever order they are added in; the base layer stays put', async () => {
    const base = { kind: 'base' };
    const f = fixture({ baseLayers: [base] });
    const name = (layer) => layer === base ? 'base' : layer.name;
    const tagged = async (id, extra = {}) => {
        await f.controller.upsert(createRasterLayerState({ id, source: xyz({ template: `https://${id}/{z}/{x}/{y}` }), ...extra }));
        const layer = f.map.layers.find((l) => l.getProvider?.().getURL(0, 0, 0) === `https://${id}/0/0/0`);
        layer.name = id;
    };
    await tagged('mc-marker-tiles');
    await tagged('high', { zIndex: 5 });
    await tagged(POLYLINE_TILE_LAYER_ID);
    await tagged(POLYGON_TILE_LAYER_ID);
    const ground = { kind: 'object', name: 'ground' };
    addStackedLayer(f.map, ground, 'groundImage');
    await tagged(CIRCLE_TILE_LAYER_ID);
    await tagged('low', { zIndex: -2 });
    await tagged('high-later', { zIndex: 5 });
    assert.deepEqual(f.map.layers.map(name), [
        'base', 'low', 'high', 'high-later', 'ground',
        POLYGON_TILE_LAYER_ID, CIRCLE_TILE_LAYER_ID, POLYLINE_TILE_LAYER_ID, 'mc-marker-tiles',
    ]);
});

test('spatial objects get a zIndex band of 1024 per kind, polygon < circle < polyline', () => {
    assert.equal(spatialStackZIndex('polygon', 0), 2048);
    assert.equal(spatialStackZIndex('circle', 0), 3072);
    assert.equal(spatialStackZIndex('polyline', 0), 4096);
    assert.equal(spatialStackZIndex('polygon', 7), 2055);
    assert.equal(spatialStackZIndex('polygon', null), 2048);
    // A zIndex never reaches into the next band.
    assert.equal(spatialStackZIndex('polygon', 10_000), 2048 + 511);
    assert.equal(spatialStackZIndex('circle', -10_000), 3072 - 511);
    assert.ok(spatialStackZIndex('polygon', 10_000) < spatialStackZIndex('circle', -10_000));
});
