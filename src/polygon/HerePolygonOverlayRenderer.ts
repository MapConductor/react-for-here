/**
 * Port of `HerePolygonOverlayRenderer.kt` in
 * `android-for-here/.../polygon/HerePolygonOverlayRenderer.kt`.
 *
 * First version renders only the simple polygon path (no hole mask tile layer).
 * The Android masking-via-raster-layer workaround for world-mask polygons is
 * intentionally omitted; the JS API handles holes natively via
 * `H.map.Polygon`'s exterior + interior rings.
 */
import {
  AbstractPolygonOverlayRenderer,
  type PolygonEntity,
  type PolygonState,
} from '@mapconductor/js-sdk-core';
import type { HereActualPolygon } from '../HereTypeAlias';
import { HereViewHolder } from '../HereViewHolder';
import { toGeoCoordinates } from '../GeoPoint';
import { createInterpolatePoints } from '../helpers';

export class HerePolygonOverlayRenderer extends AbstractPolygonOverlayRenderer<
  HereViewHolder,
  HereActualPolygon
> {
  override async createPolygon(state: PolygonState): Promise<HereActualPolygon | null> {
    const polygon = buildPolygon(state);
    this.holder.map.addObject(polygon);
    return polygon as HereActualPolygon;
  }

  override async updatePolygonProperties({
    polygon,
    current,
    prev,
  }: {
    polygon: HereActualPolygon;
    current: PolygonEntity<HereActualPolygon>;
    prev: PolygonEntity<HereActualPolygon>;
  }): Promise<HereActualPolygon | null> {
    const finger = current.fingerPrint;
    const prevFinger = prev.fingerPrint;

    const geometryChanged =
      finger.points !== prevFinger.points ||
      finger.holes !== prevFinger.holes ||
      finger.geodesic !== prevFinger.geodesic;
    if (geometryChanged) {
      this.holder.map.removeObject(polygon);
      return await this.createPolygon(current.state);
    }

    if (
      finger.strokeColor !== prevFinger.strokeColor ||
      finger.strokeWidth !== prevFinger.strokeWidth ||
      finger.fillColor !== prevFinger.fillColor
    ) {
      polygon.setStyle({
        strokeColor: current.state.strokeColor,
        fillColor: current.state.fillColor,
        lineWidth: current.state.strokeWidth,
      });
    }

    if (finger.zIndex !== prevFinger.zIndex) {
      polygon.setZIndex(coerceZIndex(current.state.zIndex));
    }

    return polygon;
  }

  override async removePolygon(
    entity: PolygonEntity<HereActualPolygon>,
  ): Promise<void> {
    if (entity.polygon) this.holder.map.removeObject(entity.polygon);
  }
}

function buildPolygon(state: PolygonState): H.map.Polygon {
  const exterior = buildLineString(state.points, state.geodesic);
  const interiors = state.holes.map((hole) => buildLineString(hole, state.geodesic));
  const geometry = new H.geo.Polygon(exterior, interiors);
  const polygon = new H.map.Polygon(geometry, {
    style: {
      strokeColor: state.strokeColor,
      fillColor: state.fillColor,
      lineWidth: state.strokeWidth,
    },
    zIndex: coerceZIndex(state.zIndex),
    data: state.id,
  });
  return polygon;
}

function buildLineString(
  points: PolygonState['points'],
  geodesic: boolean,
): H.geo.LineString {
  const lineString = new H.geo.LineString();
  const interpolated = geodesic ? createInterpolatePoints(points) : points;
  for (const point of interpolated) {
    lineString.pushPoint(toGeoCoordinates(point));
  }
  return lineString;
}

function coerceZIndex(zIndex: number): number {
  // Mirrors `state.zIndex.coerceIn(0, 511)` in Android.
  return Math.max(0, Math.min(511, zIndex));
}
