/**
 * Mirrors `GeoPoint.kt` in `android-for-here/.../GeoPoint.kt`.
 *
 * `GeoPoint.toGeoCoordinates()` / `GeoCoordinates.toGeoPoint()` /
 * `GeoCoordinates.toUpdate()` / `GeoOrientation.toUpdate()` bridge between
 * MapConductor `GeoPoint` and the HERE SDK for Mobile types. The HERE Maps
 * API for JavaScript uses `H.geo.GeoPoint`/`H.geo.GeoCoord` with `lat`/`lng`
 * (instead of latitude/longitude), so the conversion is direct.
 */
import { createGeoPoint, type GeoPoint, type GeoPointInterface } from '@mapconductor/js-sdk-core';

export function toGeoCoordinates(position: GeoPointInterface): H.geo.GeoCoord {
  return new H.geo.Point(position.latitude, position.longitude, position.altitude ?? 0);
}

export function toGeoPoint(coord: H.geo.GeoCoord): GeoPoint {
  return createGeoPoint({ latitude: coord.lat, longitude: coord.lng, altitude: coord.alt });
}

export function geoPointFromLatLng(lat: number, lng: number, alt = 0): GeoPoint {
  return createGeoPoint({ latitude: lat, longitude: lng, altitude: alt });
}
