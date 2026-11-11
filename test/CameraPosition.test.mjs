import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';
import { installFakeHere } from './support/fakeHere.mjs';
import { buildSources } from './support/buildSources.mjs';

// MapConductor のカメラ（Google 基準のズーム、負の tilt を含む）と HERE JS の
// lookAt との変換を確かめる。ズーム変換は恒等で 0〜22 に丸めること、
// 明示的なカメラ指定はズームを整数に寄せ（fitBounds は寄せない）、HERE が
// 持てない bearing/tilt は lookAt では 0 にすること、負の tilt は注視点を前へ
// ずらして |tilt| で描き、読み戻しでは元の側へ戻すことを見る。
installFakeHere();
const { camera, zoom } = await buildSources('camera-position-tests', {
    camera: 'src/MapCameraPosition.ts',
    zoom: 'src/zoom/ZoomAltitudeConverter.ts',
});
const { toHereDisplayCamera, toHereLookAtData, lookAtToMapCameraPosition, mapCameraPositionFrom } = camera;
const { ZoomAltitudeConverter } = zoom;

const close = (actual, expected, eps = 1e-9, message) =>
    assert.ok(Math.abs(actual - expected) <= eps, message ?? `${actual} ≉ ${expected}`);

function cam({ lat = 35, lng = 139, zoom = 10, bearing = 0, tilt = 0 } = {}) {
    return createMapCameraPosition({ position: createGeoPoint({ latitude: lat, longitude: lng }), zoom, bearing, tilt });
}

test('HERE ⇄ Google zoom is the identity, clamped to 0..22 at every latitude', () => {
    assert.equal(ZoomAltitudeConverter.HERE_ZOOM_TO_GOOGLE_ZOOM_AT_EQUATOR, 0);
    for (const lat of [0, 35, 80]) {
        assert.equal(ZoomAltitudeConverter.hereZoomToGoogleZoom(7.25, lat), 7.25);
        assert.equal(ZoomAltitudeConverter.googleZoomToHereZoom(7.25, lat), 7.25);
    }
    assert.equal(ZoomAltitudeConverter.hereZoomToGoogleZoom(-3, 0), 0);
    assert.equal(ZoomAltitudeConverter.googleZoomToHereZoom(30, 0), 22);
});

test('zoom and altitude convert both ways', () => {
    const converter = new ZoomAltitudeConverter();
    const altitude = converter.zoomLevelToAltitude({ zoomLevel: 12, latitude: 35, tilt: 0 });
    assert.ok(altitude > 0);
    close(converter.altitudeToZoomLevel({ altitude, latitude: 35, tilt: 0 }), 12, 1e-6);
    // One level up halves the altitude.
    const higher = converter.zoomLevelToAltitude({ zoomLevel: 13, latitude: 35, tilt: 0 });
    close(higher * 2, altitude, altitude * 1e-9);
});

test('explicit camera targets snap the zoom to an integer; fitBounds keeps the fraction', () => {
    assert.equal(toHereDisplayCamera(cam({ zoom: 9.5 })).hereZoomLevel, 10);
    assert.equal(toHereDisplayCamera(cam({ zoom: 4.4 })).hereZoomLevel, 4);
    assert.equal(toHereDisplayCamera(cam({ zoom: 9.5 }), { snapZoom: false }).hereZoomLevel, 9.5);
});

test('a non-negative tilt keeps the target, tilt and bearing as they are', () => {
    const display = toHereDisplayCamera(cam({ lat: 21.3, lng: -157.8, zoom: 8, bearing: 30, tilt: 45 }));
    assert.equal(display.target.latitude, 21.3);
    assert.equal(display.target.longitude, -157.8);
    assert.equal(display.tiltDeg, 45);
    assert.equal(display.bearing, 30);
    assert.equal(display.hereZoomLevel, 8);
});

test('the lookAt carries position and zoom only: bearing and tilt are drawn by CSS', () => {
    const lookAt = toHereLookAtData(cam({ lat: 10, lng: 20, zoom: 6.6, bearing: 45, tilt: 30 }));
    assert.equal(lookAt.position.lat, 10);
    assert.equal(lookAt.position.lng, 20);
    assert.equal(lookAt.position.alt, 0);
    assert.equal(lookAt.zoom, 7);
    assert.equal(lookAt.heading, 0);
    assert.equal(lookAt.tilt, 0);
    assert.equal(toHereLookAtData(cam({ zoom: 6.6 }), { snapZoom: false }).zoom, 6.6);
});

test('a negative tilt pushes the target forward and renders with |tilt| (capped at 60)', () => {
    const origin = cam({ lat: 35, lng: 139, zoom: 10, bearing: 0, tilt: -30 });
    const display = toHereDisplayCamera(origin);
    assert.equal(display.tiltDeg, 30);
    assert.equal(display.bearing, 0);
    // Bearing 0 looks north, so the ground target moves north along the meridian.
    assert.ok(display.target.latitude > 35, `target ${display.target.latitude} should be north of 35`);
    close(display.target.longitude, 139, 1e-9);
    // Zoom is pulled back by 0.9 level at the 60° cap, proportionally below it.
    close(display.hereZoomLevel, 10 - 0.9 * (30 / 60));

    const steep = toHereDisplayCamera(cam({ zoom: 10, tilt: -80 }));
    assert.equal(steep.tiltDeg, 60);
    close(steep.hereZoomLevel, 10 - 0.9);
    // The further the tilt, the further the shift.
    const shallow = toHereDisplayCamera(cam({ zoom: 10, tilt: -10 }));
    assert.ok(shallow.target.latitude < display.target.latitude);
});

test('a negative tilt snaps the requested zoom like a positive one; snapZoom:false keeps it', () => {
    // 正の傾きと同じく、要求ズームを整数に丸めてから傾きぶんの補正を足す。
    const snapped = toHereDisplayCamera(cam({ zoom: 9.6, tilt: -30 }));
    close(snapped.hereZoomLevel, 10 - 0.9 * (30 / 60));
    close(toHereDisplayCamera(cam({ zoom: 9.6, tilt: 30 })).hereZoomLevel, 10);
    // 前に送る距離も丸めた後のズームで決まる（同じ整数ズームなら同じ位置）。
    const atTen = toHereDisplayCamera(cam({ zoom: 10, tilt: -30 }));
    close(snapped.target.latitude, atTen.target.latitude, 1e-12);

    const fractional = toHereDisplayCamera(cam({ zoom: 9.6, tilt: -30 }), { snapZoom: false });
    close(fractional.hereZoomLevel, 9.6 - 0.9 * (30 / 60));
});

test('reading back a lookAt with no negative hint reports it as is', () => {
    const lookAt = { position: { lat: 12, lng: 34 }, zoom: 11.3, heading: 0, tilt: 20 };
    for (const hint of [null, 0, 15]) {
        const position = lookAtToMapCameraPosition(lookAt, hint);
        assert.equal(position.position.latitude, 12);
        assert.equal(position.position.longitude, 34);
        assert.equal(position.zoom, 11.3);
        assert.equal(position.tilt, 20);
        assert.equal(position.bearing + 0, 0); // -0 from normalizing -heading
    }
    // A flat lookAt is not shifted even when the hint is negative.
    const flat = lookAtToMapCameraPosition({ ...lookAt, tilt: 0 }, -20);
    assert.equal(flat.position.latitude, 12);
    assert.equal(flat.tilt, 0);
});

test('reading back with a negative hint moves the target back and reports a negative tilt', () => {
    const lookAt = { position: { lat: 35.1, lng: 139 }, zoom: 9.55, heading: 0, tilt: 30 };
    const position = lookAtToMapCameraPosition(lookAt, -30);
    assert.equal(position.tilt, -30);
    assert.ok(position.position.latitude < 35.1, 'moved back south, opposite the heading');
    close(position.position.longitude, 139, 1e-9);
    // Altitude shrinks by cos(tilt): about +0.21 level, plus a hair for the latitude change.
    close(position.zoom, 9.55 - Math.log2(Math.cos(Math.PI / 6)), 0.05);
    assert.ok(position.zoom > 9.55);
});

test('mapCameraPositionFrom copies every field', () => {
    const source = cam({ lat: 1, lng: 2, zoom: 3, bearing: 4, tilt: 5 });
    const copy = mapCameraPositionFrom(source);
    assert.equal(copy.position.latitude, 1);
    assert.equal(copy.position.longitude, 2);
    assert.equal(copy.zoom, 3);
    assert.equal(copy.bearing, 4);
    assert.equal(copy.tilt, 5);
});
