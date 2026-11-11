import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createCircleState,
    createGeoPoint,
    createPolygonState,
    createPolylineState,
} from '@mapconductor/js-sdk-core';
import { createFakeMap, installFakeHere } from './support/fakeHere.mjs';
import { buildSources } from './support/buildSources.mjs';

// ポリゴン・サークル・ポリラインを、地図だけ偽物にして実際のコントローラ＋
// レンダラーで動かす。H.map.Polygon / Polyline に渡る形（穴、閉じた輪、
// 経度の正規化、日付変更線をまたぐ円）とスタイル、種類ごとの zIndex の帯、
// 形が変わったら作り直し・色や zIndex はその場で変えることを確かめる。
installFakeHere();
const m = await buildSources('spatial-tests', {
    polygonController: 'src/polygon/HerePolygonController.ts',
    polygonRenderer: 'src/polygon/HerePolygonOverlayRenderer.ts',
    circleController: 'src/circle/HereCircleController.ts',
    circleRenderer: 'src/circle/HereCircleOverlayRenderer.ts',
    polylineController: 'src/polyline/HerePolylineController.ts',
    polylineRenderer: 'src/polyline/HerePolylineOverlayRenderer.ts',
});

function fixture(kind) {
    const map = createFakeMap();
    const holder = { map };
    const Renderer = m[`${kind}Renderer`][`Here${kind[0].toUpperCase()}${kind.slice(1)}OverlayRenderer`];
    const Controller = m[`${kind}Controller`][`Here${kind[0].toUpperCase()}${kind.slice(1)}Controller`];
    return { map, controller: new Controller(new Renderer(holder)) };
}

const pts = (list) => list.map(([latitude, longitude]) => createGeoPoint({ latitude, longitude }));
const coords = (lineString) => lineString.points.map((p) => [p.lat, p.lng]);
const square = pts([[0, 0], [0, 1], [1, 1], [1, 0]]);
const hole = pts([[0.4, 0.4], [0.4, 0.6], [0.6, 0.6], [0.6, 0.4]]);

// ── polygon ────────────────────────────────────────────────────────────────

const polygon = (overrides = {}) => createPolygonState({
    id: 'p', points: square, strokeColor: '#ff0000', strokeWidth: 3, fillColor: '#0000ff80', ...overrides,
});

test('a polygon is drawn with its rings, style, band zIndex and id', async () => {
    const f = fixture('polygon');
    await f.controller.composition([polygon({ holes: [hole], zIndex: 4 })]);
    assert.equal(f.map.objects.length, 1);
    const drawn = f.map.objects[0];
    assert.deepEqual(drawn.style, { strokeColor: '#ff0000', fillColor: '#0000ff80', lineWidth: 3 });
    assert.equal(drawn.zIndex, 2048 + 4);
    assert.equal(drawn.data, 'p');
    const outer = coords(drawn.geometry.exterior);
    // Densified (planar), starting at the first vertex, passing every corner.
    assert.deepEqual(outer[0], [0, 0]);
    for (const corner of [[0, 1], [1, 1], [1, 0]]) {
        assert.ok(outer.some(([a, b]) => a === corner[0] && b === corner[1]), `corner ${corner} is on the ring`);
    }
    assert.equal(drawn.geometry.interiors.length, 1);
    const inHole = (v) => v >= 0.4 - 1e-9 && v <= 0.6 + 1e-9;
    assert.ok(coords(drawn.geometry.interiors[0]).every(([lat, lng]) => inHole(lat) && inHole(lng)));
});

test('polygon longitudes are normalised into -180..180', async () => {
    const f = fixture('polygon');
    await f.controller.composition([polygon({ points: pts([[0, 179], [0, 181], [1, 181], [1, 179]]) })]);
    for (const [, lng] of coords(f.map.objects[0].geometry.exterior)) {
        assert.ok(lng >= -180 && lng <= 180, `${lng} is in range`);
    }
});

test('a polygon style or zIndex change is applied in place', async () => {
    const f = fixture('polygon');
    await f.controller.composition([polygon()]);
    const drawn = f.map.objects[0];
    await f.controller.composition([polygon({ fillColor: '#00ff00', strokeWidth: 9 })]);
    assert.equal(f.map.objects[0], drawn);
    assert.deepEqual(drawn.style, { strokeColor: '#ff0000', fillColor: '#00ff00', lineWidth: 9 });
    await f.controller.composition([polygon({ fillColor: '#00ff00', strokeWidth: 9, zIndex: -3 })]);
    assert.equal(f.map.objects[0], drawn);
    assert.equal(drawn.zIndex, 2048 - 3);
});

test('a polygon geometry change replaces the object; clear removes it', async () => {
    const f = fixture('polygon');
    await f.controller.composition([polygon()]);
    const before = f.map.objects[0];
    await f.controller.composition([polygon({ holes: [hole] })]);
    assert.equal(f.map.objects.length, 1);
    assert.notEqual(f.map.objects[0], before);
    assert.equal(f.map.objects[0].geometry.interiors.length, 1);
    await f.controller.clear();
    assert.equal(f.map.objects.length, 0);
});

// ── circle ─────────────────────────────────────────────────────────────────

const circle = (overrides = {}) => createCircleState({
    id: 'c', center: createGeoPoint({ latitude: 35, longitude: 139 }), radiusMeters: 1000,
    strokeColor: '#111111', strokeWidth: 2, fillColor: '#22222280', ...overrides,
});

const metres = (a, b) => {
    const R = 6_371_008.8;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

test('a circle is a closed polygon ring at the radius, in the circle band', async () => {
    const f = fixture('circle');
    await f.controller.composition([circle({ zIndex: 2 })]);
    assert.equal(f.map.objects.length, 1);
    const drawn = f.map.objects[0];
    assert.equal(drawn.constructor, H.map.Polygon);
    assert.deepEqual(drawn.style, { strokeColor: '#111111', fillColor: '#22222280', lineWidth: 2 });
    assert.equal(drawn.zIndex, 3072 + 2);
    assert.equal(drawn.data, 'c');
    const ring = coords(drawn.geometry.exterior);
    assert.ok(ring.length >= 4);
    assert.deepEqual(ring.at(-1), ring[0], 'the ring is closed');
    for (const point of ring) {
        const d = metres([35, 139], point);
        assert.ok(Math.abs(d - 1000) < 5, `${d}m from the centre`);
    }
});

test('a circle across the antimeridian stays continuous (no wrap back to -180)', async () => {
    const f = fixture('circle');
    await f.controller.composition([circle({ center: createGeoPoint({ latitude: 0, longitude: 179.99 }), radiusMeters: 5000 })]);
    const lngs = coords(f.map.objects[0].geometry.exterior).map(([, lng]) => lng);
    assert.ok(lngs.some((lng) => lng > 180), 'part of the ring is past 180');
    assert.ok(lngs.every((lng) => lng > 179), 'and none jumps to the other side');
});

test('circle style changes in place; a radius change rebuilds it', async () => {
    const f = fixture('circle');
    await f.controller.composition([circle()]);
    const drawn = f.map.objects[0];
    await f.controller.composition([circle({ strokeColor: '#abcdef' })]);
    assert.equal(f.map.objects[0], drawn);
    assert.equal(drawn.style.strokeColor, '#abcdef');
    await f.controller.composition([circle({ strokeColor: '#abcdef', radiusMeters: 2000 })]);
    assert.equal(f.map.objects.length, 1);
    assert.notEqual(f.map.objects[0], drawn);
    const point = coords(f.map.objects[0].geometry.exterior)[0];
    assert.ok(Math.abs(metres([35, 139], point) - 2000) < 10);
});

// ── polyline ───────────────────────────────────────────────────────────────

const polyline = (overrides = {}) => createPolylineState({
    id: 'l', points: pts([[0, 0], [0, 10]]), strokeColor: '#336699', strokeWidth: 4, ...overrides,
});

test('a polyline is drawn with a square cap in the polyline band', async () => {
    const f = fixture('polyline');
    await f.controller.composition([polyline({ zIndex: 1 })]);
    const drawn = f.map.objects[0];
    assert.equal(drawn.constructor, H.map.Polyline);
    assert.deepEqual(drawn.style, { strokeColor: '#336699', lineWidth: 4, lineCap: 'square' });
    assert.equal(drawn.zIndex, 4096 + 1);
    assert.equal(drawn.data, 'l');
    const line = coords(drawn.geometry);
    assert.deepEqual(line[0], [0, 0]);
    assert.deepEqual(line.at(-1), [0, 10]);
});

test('a geodesic polyline bows toward the pole; a planar one keeps its latitude', async () => {
    const points = pts([[40, -30], [40, 30]]);
    const f = fixture('polyline');
    await f.controller.composition([polyline({ points, geodesic: true })]);
    const geodesic = coords(f.map.objects[0].geometry);
    assert.ok(Math.max(...geodesic.map(([lat]) => lat)) > 42);
    await f.controller.composition([polyline({ points, geodesic: false })]);
    const planar = coords(f.map.objects[0].geometry);
    assert.ok(planar.every(([lat]) => Math.abs(lat - 40) < 1e-9));
});

test('polyline style and zIndex change in place; new points rebuild it', async () => {
    const f = fixture('polyline');
    await f.controller.composition([polyline()]);
    const drawn = f.map.objects[0];
    await f.controller.composition([polyline({ strokeWidth: 8, zIndex: 3 })]);
    assert.equal(f.map.objects[0], drawn);
    assert.deepEqual(drawn.style, { strokeColor: '#336699', lineWidth: 8, lineCap: 'square' });
    assert.equal(drawn.zIndex, 4099);
    await f.controller.composition([polyline({ strokeWidth: 8, zIndex: 3, points: pts([[1, 1], [2, 2]]) })]);
    assert.equal(f.map.objects.length, 1);
    assert.notEqual(f.map.objects[0], drawn);
    await f.controller.composition([]);
    assert.equal(f.map.objects.length, 0);
});
