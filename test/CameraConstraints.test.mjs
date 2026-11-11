import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeoPoint, createGeoRectBounds, createMapCameraPosition } from '@mapconductor/js-sdk-core';
import { createFakeMap, installFakeHere } from './support/fakeHere.mjs';
import { buildSources } from './support/buildSources.mjs';

// HERE JS にはカメラ範囲の制限が無いので、HereCameraConstraints が自前で丸める。
// ズームの上下限、中心の矩形クランプ、可視領域ごと矩形に収める補正
// （はみ出したら中心をずらす・矩形より広ければ矩形へ fit）と、
// 次フレームの再補正が 1 本だけ予約されることを、偽の地図で確かめる。
// 後半は HereCameraState：負の tilt の論理カメラの保持と、HERE に無い
// 移動開始・終了イベントの合成（無操作 120ms で終了）を見る。
installFakeHere();
const { constraints, state } = await buildSources('camera-constraints-tests', {
    constraints: 'src/HereCameraConstraints.ts',
    state: 'src/HereCameraState.ts',
});
const { HereCameraConstraints } = constraints;
const { HereCameraState } = state;

const frames = [];
globalThis.requestAnimationFrame = (fn) => { frames.push({ fn, cancelled: false }); return frames.length - 1; };
globalThis.cancelAnimationFrame = (id) => { frames[id].cancelled = true; };
const pendingFrames = () => frames.filter((f) => !f.cancelled && !f.ran);
function runFrames() {
    for (const frame of pendingFrames()) { frame.ran = true; frame.fn(); }
}

function bounds(south, west, north, east) {
    const b = createGeoRectBounds();
    b.extend(createGeoPoint({ latitude: south, longitude: west }));
    b.extend(createGeoPoint({ latitude: north, longitude: east }));
    return b;
}

/** A visible region of ±halfLat/±halfLng around the current lookAt. */
function fixture({ restriction, halfLat = 1, halfLng = 1, lookAt } = {}) {
    const map = createFakeMap();
    if (lookAt) map.setLookAt(lookAt);
    const deps = {
        map,
        getVisibleRegion() {
            const { lat, lng } = map.getViewModel().getLookAtData().position;
            return { bounds: bounds(lat - halfLat, lng - halfLng, lat + halfLat, lng + halfLng) };
        },
    };
    return { map, constraints: new HereCameraConstraints(deps, restriction) };
}

test('constrain clamps zoom and the centre, and leaves the rest of the lookAt alone', () => {
    const { constraints: c } = fixture({ restriction: { bounds: bounds(30, 130, 40, 140), minZoom: 4, maxZoom: 12 } });
    const out = c.constrain({ position: { lat: 50, lng: 120, alt: 7 }, zoom: 20, heading: 0, tilt: 0 });
    assert.deepEqual(out, { position: { lat: 40, lng: 130, alt: 7 }, zoom: 12, heading: 0, tilt: 0 });
    assert.equal(c.constrain({ position: { lat: 35, lng: 135 }, zoom: 1 }).zoom, 4);
    // No zoom in → no zoom out.
    assert.equal('zoom' in c.constrain({ position: { lat: 35, lng: 135 } }), false);
});

test('set(null) lifts every restriction', () => {
    const { constraints: c } = fixture({ restriction: { bounds: bounds(30, 130, 40, 140), minZoom: 4, maxZoom: 12 } });
    c.set(null);
    const out = c.constrain({ position: { lat: 80, lng: -170 }, zoom: 21 });
    assert.deepEqual(out, { position: { lat: 80, lng: -170 }, zoom: 21 });
    c.set({ maxZoom: 5 });
    assert.deepEqual(c.constrain({ position: { lat: 80, lng: -170 }, zoom: 21 }), { position: { lat: 80, lng: -170 }, zoom: 5 });
});

test('enforce moves a centre outside the bounds back in and schedules one more pass', () => {
    const { map, constraints: c } = fixture({
        restriction: { bounds: bounds(30, 130, 40, 140) },
        lookAt: { position: { lat: 45, lng: 135 }, zoom: 8, heading: 0, tilt: 0 },
    });
    assert.equal(c.enforce(), true);
    assert.equal(map.lookAtCalls.length, 1);
    assert.equal(map.lookAtCalls[0].animated, false);
    assert.equal(map.lookAtCalls[0].data.position.lat, 40);
    assert.equal(pendingFrames().length, 1);
    // The scheduled pass keeps the whole visible region inside: the centre comes down by half a span.
    runFrames();
    assert.equal(map.getViewModel().getLookAtData().position.lat, 39);
    c.dispose();
});

test('enforce shifts the centre so the visible region stays inside the bounds', () => {
    const { map, constraints: c } = fixture({
        restriction: { bounds: bounds(30, 130, 40, 140) },
        lookAt: { position: { lat: 39.5, lng: 130.2 }, zoom: 8, heading: 0, tilt: 0 },
    });
    assert.equal(c.enforce(), true);
    const { position } = map.getViewModel().getLookAtData();
    assert.ok(Math.abs(position.lat - 39) < 1e-9);
    assert.ok(Math.abs(position.lng - 131) < 1e-9);
    // Already inside: nothing more to do.
    assert.equal(c.enforce(), false);
    assert.equal(map.lookAtCalls.length, 1);
});

test('enforce fits the bounds when the visible region is wider than they are', () => {
    const { map, constraints: c } = fixture({
        restriction: { bounds: bounds(30, 130, 40, 140) },
        halfLat: 8, halfLng: 8,
        lookAt: { position: { lat: 35, lng: 135 }, zoom: 3, heading: 0, tilt: 0 },
    });
    assert.equal(c.enforce(), true);
    const rect = map.lookAtCalls[0].data.bounds;
    // H.geo.Rect(top, left, bottom, right)
    assert.deepEqual({ top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right },
        { top: 40, left: 130, bottom: 30, right: 140 });
});

test('enforce with no bounds does nothing', () => {
    const { map, constraints: c } = fixture({ lookAt: { position: { lat: 80, lng: 0 }, zoom: 3, heading: 0, tilt: 0 } });
    assert.equal(c.enforce(), false);
    assert.equal(map.lookAtCalls.length, 0);
});

test('schedule keeps only the latest frame, and dispose cancels it', () => {
    const { constraints: c } = fixture();
    const before = pendingFrames().length;
    c.schedule();
    c.schedule();
    assert.equal(pendingFrames().length, before + 1);
    c.dispose();
    assert.equal(pendingFrames().length, before);
});

// ── HereCameraState ────────────────────────────────────────────────────────

function cameraFixture() {
    const map = createFakeMap();
    const holder = {
        map,
        mapView: { parentElement: { clientWidth: 200, clientHeight: 100 } },
        fromScreenOffsetSync: ({ x, y }) => {
            const { lat, lng } = map.getViewModel().getLookAtData().position;
            return createGeoPoint({ latitude: lat + (50 - y) / 100, longitude: lng + (x - 100) / 100 });
        },
    };
    const events = [];
    const noConstraints = { constrain: (d) => d, enforce: () => false };
    const camera = new HereCameraState({
        holder,
        constraints: noConstraints,
        onCameraMoveStart: (c) => events.push(['start', c]),
        onCameraMove: (c) => events.push(['move', c]),
        onCameraMoveEnd: (c) => events.push(['end', c]),
        onCameraSettled: async (c) => { events.push(['settled', c]); },
    });
    return { map, camera, events, kinds: () => events.map(([k]) => k) };
}

const position = (lat, lng, zoom, tilt = 0, bearing = 0) =>
    createMapCameraPosition({ position: createGeoPoint({ latitude: lat, longitude: lng }), zoom, tilt, bearing });

test('apply without animation commits the lookAt immediately', async () => {
    const { map, camera } = cameraFixture();
    assert.equal(await camera.apply(position(10, 20, 5.6), { animated: false }), true);
    assert.equal(map.lookAtCalls.length, 1);
    const { data, animated } = map.lookAtCalls[0];
    assert.equal(animated, false);
    assert.deepEqual({ ...data, position: { ...data.position } },
        { position: { lat: 10, lng: 20, alt: 0 }, zoom: 6, heading: 0, tilt: 0 });
    await camera.apply(position(10, 20, 5.6), { animated: false, snapZoom: false });
    assert.equal(map.lookAtCalls[1].data.zoom, 5.6);
});

test('an animated apply reports move end once, on the next mapviewchangeend', async () => {
    const { map, camera, kinds } = cameraFixture();
    await camera.apply(position(10, 20, 5), { animated: true });
    assert.equal(map.lookAtCalls[0].animated, true);
    // Changes while animating are not reported as gestures.
    camera.onChange();
    assert.deepEqual(kinds(), []);
    map.emit('mapviewchangeend');
    assert.deepEqual(kinds(), ['end']);
    assert.equal(map.listenerCount('mapviewchangeend'), 0);
    map.emit('mapviewchangeend');
    assert.deepEqual(kinds(), ['end']);
});

test('read reports the logical camera, with the visible region from the four corners', async () => {
    const { camera } = cameraFixture();
    await camera.apply(position(10, 20, 5, 30, 15), { animated: false });
    const read = camera.read();
    assert.equal(read.position.latitude, 10);
    assert.equal(read.zoom, 5);
    assert.equal(read.tilt, 30);
    assert.equal(read.bearing, 15);
    assert.equal(camera.visualTilt, 30);
    assert.equal(camera.visualBearing, 15);
    const region = read.visibleRegion;
    assert.equal(region.farLeft.latitude, 10.5);
    assert.equal(region.farLeft.longitude, 19);
    assert.equal(region.nearRight.latitude, 9.5);
    assert.equal(region.nearRight.longitude, 21);
    assert.equal(region.bounds.northEast.latitude, 10.5);
    assert.equal(region.bounds.southWest.longitude, 19);
});

test('a negative tilt reads back the requested position and zoom, not the shifted lookAt', async () => {
    const { map, camera } = cameraFixture();
    await camera.apply(position(35, 139, 10, -30), { animated: false });
    assert.ok(map.getViewModel().getLookAtData().position.lat > 35, 'HERE was given a shifted target');
    const read = camera.read();
    assert.equal(read.position.latitude, 35);
    assert.equal(read.position.longitude, 139);
    assert.equal(read.zoom, 10);
    assert.equal(read.tilt, -30);
    assert.equal(camera.visualTilt, 30);
});

test('gesture changes synthesize start once, move each time, and end after 120ms idle', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { camera, kinds } = cameraFixture();
    camera.onChange();
    camera.onChange();
    assert.deepEqual(kinds(), ['start', 'move', 'move']);
    camera.onChangeEnd();
    t.mock.timers.tick(100);
    camera.onChangeEnd(); // restarts the idle window
    t.mock.timers.tick(100);
    assert.deepEqual(kinds(), ['start', 'move', 'move']);
    t.mock.timers.tick(20);
    assert.deepEqual(kinds(), ['start', 'move', 'move', 'settled', 'end']);
    // A new gesture starts again.
    camera.onChange();
    assert.deepEqual(kinds().slice(-2), ['start', 'move']);
    camera.dispose();
});

test('a change corrected by the constraints is not reported', () => {
    const map = createFakeMap();
    const events = [];
    const camera = new HereCameraState({
        holder: { map, mapView: { parentElement: null }, fromScreenOffsetSync: () => null },
        constraints: { constrain: (d) => d, enforce: () => true },
        onCameraMoveStart: () => events.push('start'),
        onCameraMove: () => events.push('move'),
        onCameraMoveEnd: () => events.push('end'),
        onCameraSettled: async () => events.push('settled'),
    });
    camera.onChange();
    camera.onChangeEnd();
    assert.deepEqual(events, []);
});
