/**
 * Mirrors `GeoRectBounds.kt` in `android-for-here/.../GeoRectBounds.kt`.
 *
 * Bridges MapConductor `GeoRectBounds` and the HERE `H.geo.Rect`.
 */
import {
  createGeoRectBounds,
  type GeoPointInterface,
  type GeoRectBounds,
} from '@mapconductor/js-sdk-core';
import { toGeoPoint } from './GeoPoint';

export function toGeoRect(bounds: GeoRectBounds): H.geo.Rect | null {
  const sw = bounds.southWest;
  const ne = bounds.northEast;
  if (!sw || !ne) return null;

  // H.geo.Rect constructor signature is (top, left, bottom, right).
  return new H.geo.Rect(ne.latitude, sw.longitude, sw.latitude, ne.longitude);
}

export function toGeoRectBounds(rect: H.geo.Rect): GeoRectBounds {
  const topLeft = rect.getTopLeft();
  const bottomRight = rect.getBottomRight();
  const bounds = createGeoRectBounds();
  bounds.extend(toGeoPoint(topLeft) as GeoPointInterface);
  bounds.extend(toGeoPoint(bottomRight) as GeoPointInterface);
  return bounds;
}
