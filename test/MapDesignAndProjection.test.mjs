import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeoPoint, createGeoRectBounds, MapUISettings } from '@mapconductor/js-sdk-core';
import { createFakeMap, installFakeHere } from './support/fakeHere.mjs';
import { buildSources } from './support/buildSources.mjs';

// 地図デザインとベースレイヤー、座標・矩形・アイコンの変換、ジェスチャー設定、
// そして HereViewHolder の画面座標変換を確かめる。HERE JS は bearing/tilt を
// 持てないので、2D ビューは地図面を CSS で回転・傾斜させている。holder の
// geo⇄screen はその変形を前後で打ち消す必要があり、往復で元に戻ることを見る。
const H = installFakeHere();
H.mapevents = { Behavior: { Feature: { PANNING: 1, PINCH_ZOOM: 2, WHEEL_ZOOM: 4, DBL_TAP_ZOOM: 8 } } };
const m = await buildSources('design-projection-tests', {
    design: 'src/HereMapDesign.ts',
    controller: 'src/HereMapViewController.ts',
    store: 'src/HereViewControllerStore.ts',
    settings: 'src/HereMapSettings.ts',
    geoPoint: 'src/GeoPoint.ts',
    geoRect: 'src/GeoRectBounds.ts',
    bitmap: 'src/BitmapIcon.ts',
    holder: 'src/HereViewHolder.ts',
    gestures: 'src/HereGestureHandlers.ts',
});
const { HereMapDesign } = m.design;
const { resolveHereBaseLayer, HereDesignId } = m.controller;
const { setHerePlatform, getHerePlatform, HereMapViewControllerStore } = m.store;
const { applyGestureSettings, applyMapDesignType } = m.settings;
const { toGeoCoordinates, toGeoPoint, geoPointFromLatLng } = m.geoPoint;
const { toGeoRect, toGeoRectBounds } = m.geoRect;
const { toAnchor2D } = m.bitmap;
const { HereViewHolder } = m.holder;
const { toGeoPointFromEvent } = m.gestures;

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

// ── map design ─────────────────────────────────────────────────────────────

test('HereMapDesign.create finds the built-in schemes by id and rejects others', () => {
    assert.equal(HereMapDesign.create('normal.night'), HereMapDesign.NormalNight);
    assert.equal(HereMapDesign.create('satellite.day'), HereMapDesign.Satellite);
    assert.equal(HereMapDesign.create('road.network.day'), HereMapDesign.RoadNetworkDay);
    assert.throws(() => HereMapDesign.create('none'), /Unsupported MapScheme: none/);
    assert.throws(() => HereMapDesign.create('nope'), /Unsupported MapScheme/);
    const custom = HereMapDesign.Custom('my.style', [{ text: '© me' }]);
    assert.equal(custom.getValue(), 'my.style');
    assert.deepEqual(custom.attributionRules, [{ text: '© me' }]);
    assert.deepEqual(HereMapDesign.NormalDay.attributionRules, []);
});

function fakePlatform() {
    const requests = [];
    return {
        requests,
        getRasterTileService(options) { requests.push(options); return { options }; },
    };
}

test('base layers use the Raster Tile API v3 parameters per scheme', () => {
    const platform = fakePlatform();
    const expectations = [
        [HereMapDesign.NormalDay, 'base', 'explore.day', 'png8'],
        [HereMapDesign.NormalNight, 'base', 'explore.night', 'png8'],
        [HereMapDesign.Satellite, 'background', 'satellite.day', 'jpeg'],
        [HereMapDesign.HybridDay, 'base', 'explore.satellite.day', 'png8'],
        [HereMapDesign.HybridNight, 'base', 'explore.satellite.day', 'png8'],
        [HereMapDesign.Custom(HereDesignId.TerrainDay), 'base', 'topo.day', 'png8'],
        [HereMapDesign.LiteDay, 'base', 'lite.day', 'png8'],
        [HereMapDesign.LiteNight, 'base', 'lite.night', 'png8'],
        [HereMapDesign.LiteHybridDay, 'base', 'lite.satellite.day', 'png8'],
        // v3 に衛星系の夜スタイルは無いので昼の画像を使う（HybridNight と同じ扱い）。
        [HereMapDesign.LiteHybridNight, 'base', 'lite.satellite.day', 'png8'],
        [HereMapDesign.LogisticsDay, 'base', 'logistics.day', 'png8'],
        [HereMapDesign.LogisticsNight, 'base', 'logistics.night', 'png8'],
        [HereMapDesign.LogisticsHybridDay, 'base', 'logistics.satellite.day', 'png8'],
        // v3 に道路網スタイルは無い。ラベル抜き（background）の lite が一番近い。
        [HereMapDesign.RoadNetworkDay, 'background', 'lite.day', 'png8'],
        [HereMapDesign.RoadNetworkNight, 'background', 'lite.night', 'png8'],
    ];
    for (const [design, resource, style, format] of expectations) {
        const layer = resolveHereBaseLayer(platform, design);
        assert.equal(layer.kind, 'tile');
        assert.deepEqual(platform.requests.at(-1), { format, tileSize: 512, resource, queryParams: { style } });
        assert.deepEqual(layer.getProvider().options, { engineType: 'P2D', tileSize: 512 });
    }
});

test('every design create() knows has its own base layer, not the normal.day fallback', () => {
    const ids = ['normal.day', 'normal.night', 'satellite.day', 'hybrid.day', 'hybrid.night',
        'lite.day', 'lite.night', 'lite.hybrid.day', 'lite.hybrid.night',
        'logistics.day', 'logistics.night', 'logistics.hybrid.day',
        'road.network.day', 'road.network.night'];
    for (const id of ids.filter((id) => id !== 'normal.day')) {
        const platform = fakePlatform();
        resolveHereBaseLayer(platform, HereMapDesign.create(id));
        const { resource, queryParams: { style } } = platform.requests[0];
        assert.ok(!(resource === 'base' && style === 'explore.day'), `${id} falls back to normal.day`);
    }
});

test('unknown schemes fall back to normal.day; None is an empty layer with no tiles', () => {
    const platform = fakePlatform();
    resolveHereBaseLayer(platform, HereMapDesign.Custom('no.such.scheme'));
    assert.equal(platform.requests[0].queryParams.style, 'explore.day');
    const none = resolveHereBaseLayer(platform, HereMapDesign.None);
    assert.equal(none.kind, 'empty');
    assert.equal(platform.requests.length, 1);
});

test('the platform store keeps the first platform until it is cleared', () => {
    const first = fakePlatform();
    const second = fakePlatform();
    setHerePlatform(first);
    setHerePlatform(second);
    assert.equal(getHerePlatform(), first);
    assert.equal(HereMapViewControllerStore.isInitialized(), true);
    setHerePlatform(null);
    assert.equal(getHerePlatform(), null);
    assert.equal(HereMapViewControllerStore.isInitialized(), false);
    setHerePlatform(second);
    assert.equal(getHerePlatform(), second);
    setHerePlatform(null);
});

test('applyMapDesignType swaps the base layer and notifies the listener', () => {
    const map = createFakeMap();
    const seen = [];
    const deps = { holder: { map }, designType: { current: HereMapDesign.NormalDay }, designTypeListener: { current: (d) => seen.push(d.id) } };
    // No platform: the design is remembered and reported, the map is left alone.
    applyMapDesignType(deps, HereMapDesign.Satellite);
    assert.equal(map.baseLayer, undefined);
    setHerePlatform(fakePlatform());
    applyMapDesignType(deps, HereMapDesign.NormalNight);
    assert.equal(map.baseLayer.kind, 'tile');
    assert.equal(deps.designType.current, HereMapDesign.NormalNight);
    assert.deepEqual(seen, ['satellite.day', 'normal.night']);
    setHerePlatform(null);
});

// ── gestures ───────────────────────────────────────────────────────────────

test('scroll and zoom gestures map onto the Behavior feature bitmask', (t) => {
    t.mock.method(console, 'warn', () => {});
    const calls = [];
    const behavior = { enable: (f) => calls.push(['enable', f]), disable: (f) => calls.push(['disable', f]) };
    const deps = { holder: { behavior } };
    applyGestureSettings(deps, { ...MapUISettings.Default, scrollGesture: true, zoomGesture: false });
    assert.deepEqual(calls, [['enable', 1], ['disable', 2 | 4 | 8]]);
    calls.length = 0;
    applyGestureSettings(deps, { ...MapUISettings.Default, scrollGesture: false, zoomGesture: true });
    assert.deepEqual(calls, [['disable', 1], ['enable', 14]]);
});

// ── conversions ────────────────────────────────────────────────────────────

test('GeoPoint ⇄ H.geo.Point keeps lat, lng and altitude', () => {
    const coord = toGeoCoordinates(createGeoPoint({ latitude: 1.5, longitude: -2.5, altitude: 30 }));
    assert.deepEqual([coord.lat, coord.lng, coord.alt], [1.5, -2.5, 30]);
    assert.equal(toGeoCoordinates(createGeoPoint({ latitude: 1, longitude: 2 })).alt, 0);
    const back = toGeoPoint({ lat: 3, lng: 4, alt: 5 });
    assert.deepEqual([back.latitude, back.longitude, back.altitude], [3, 4, 5]);
    const fromLatLng = geoPointFromLatLng(6, 7);
    assert.deepEqual([fromLatLng.latitude, fromLatLng.longitude, fromLatLng.altitude], [6, 7, 0]);
});

test('GeoRectBounds ⇄ H.geo.Rect(top, left, bottom, right)', () => {
    const b = createGeoRectBounds();
    b.extend(createGeoPoint({ latitude: -10, longitude: 100 }));
    b.extend(createGeoPoint({ latitude: 20, longitude: 120 }));
    const rect = toGeoRect(b);
    assert.deepEqual([rect.top, rect.left, rect.bottom, rect.right], [20, 100, -10, 120]);
    const back = toGeoRectBounds(rect);
    assert.equal(back.southWest.latitude, -10);
    assert.equal(back.southWest.longitude, 100);
    assert.equal(back.northEast.latitude, 20);
    assert.equal(back.northEast.longitude, 120);
    assert.equal(toGeoRect(createGeoRectBounds()), null, 'empty bounds have no rect');
});

test('a bitmap icon anchor is scaled into pixels', () => {
    const anchor = toAnchor2D({ anchor: { x: 0.5, y: 1 }, size: { width: 48, height: 64 } });
    assert.deepEqual([anchor.x, anchor.y], [24, 64]);
});

// ── HereViewHolder projection ──────────────────────────────────────────────

/**
 * A 400×400 map plane inside a 200×100 viewport (the plane is oversized so a rotated / tilted
 * plane still covers the viewport). The native projection is linear: 1px = 0.01°.
 */
function holderFixture({ bearing = 0, tilt = 0 } = {}) {
    const map = {
        geoToScreen: (c) => ({ x: 200 + (c.lng - 0) * 100, y: 200 - (c.lat - 0) * 100 }),
        screenToGeo: (x, y) => ({ lat: (200 - y) / 100, lng: (x - 200) / 100, alt: 0 }),
    };
    const mapView = { clientWidth: 400, clientHeight: 400, parentElement: { clientWidth: 200, clientHeight: 100 } };
    const holder = new HereViewHolder(mapView, map, {});
    holder.setController({ getVisualBearing: () => bearing, getVisualTilt: () => tilt });
    return holder;
}

test('flat and north-up, the plane centre lands on the viewport centre', () => {
    const holder = holderFixture();
    const centre = holder.toScreenOffset(createGeoPoint({ latitude: 0, longitude: 0 }));
    assert.deepEqual(centre, { x: 100, y: 50 });
    const east = holder.toScreenOffset(createGeoPoint({ latitude: 0, longitude: 0.5 }));
    assert.deepEqual(east, { x: 150, y: 50 });
    const north = holder.geoToScreen(createGeoPoint({ latitude: 0.25, longitude: 0 }));
    assert.deepEqual(north, { x: 100, y: 25 });
});

test('a bearing rotates screen offsets around the viewport centre', () => {
    const holder = holderFixture({ bearing: 90 });
    const east = holder.toScreenOffset(createGeoPoint({ latitude: 0, longitude: 0.5 }));
    close(east.x, 100);
    close(east.y, 100);
});

test('a tilt foreshortens the vertical offset by cos(tilt)', () => {
    const holder = holderFixture({ tilt: 60 });
    const north = holder.toScreenOffset(createGeoPoint({ latitude: 0.5, longitude: 0 }));
    close(north.x, 100);
    close(north.y, 50 - 50 * 0.5);
});

test('screen → geo → screen round-trips under any bearing and tilt', () => {
    for (const [bearing, tilt] of [[0, 0], [30, 0], [0, 45], [135, 40], [-60, 20]]) {
        const holder = holderFixture({ bearing, tilt });
        for (const offset of [{ x: 0, y: 0 }, { x: 200, y: 100 }, { x: 37, y: 81 }]) {
            const geo = holder.fromScreenOffsetSync(offset);
            const back = holder.toScreenOffset(geo);
            close(back.x, offset.x, 1e-6);
            close(back.y, offset.y, 1e-6);
        }
    }
});

test('a point off the map reads back as null', () => {
    const holder = holderFixture();
    holder.map.screenToGeo = () => null;
    assert.equal(holder.fromScreenOffsetSync({ x: 1, y: 1 }), null);
});

// ── tap position ───────────────────────────────────────────────────────────

test('a tap uses the native projection when flat, the holder inverse when tilted or rotated', () => {
    const holder = holderFixture();
    holder.mapView.parentElement.getBoundingClientRect = () => ({ left: 10, top: 20 });
    const event = { currentPointer: { viewportX: 250, viewportY: 150 }, originalEvent: { clientX: 110, clientY: 70 } };
    const flat = toGeoPointFromEvent({ holder, getVisualTilt: () => 0, getVisualBearing: () => 0 }, event);
    assert.deepEqual([flat.latitude, flat.longitude], [0.5, 0.5]);

    const tilted = toGeoPointFromEvent({ holder, getVisualTilt: () => 30, getVisualBearing: () => 0 }, event);
    const expected = holder.fromScreenOffsetSync({ x: 100, y: 50 });
    assert.deepEqual([tilted.latitude, tilted.longitude], [expected.latitude, expected.longitude]);

    assert.equal(toGeoPointFromEvent({ holder, getVisualTilt: () => 0, getVisualBearing: () => 0 }, {}), null);
});
