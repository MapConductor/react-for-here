/**
 * Port of `HerePolylineOverlayRenderer.kt` in
 * `android-for-here/.../polyline/HerePolylineOverlayRenderer.kt`.
 *
 * Uses the HERE Maps API for JavaScript `H.map.Polyline` instead of
 * `MapPolyline`. The `LineCap.SQUARE` default and the `(zIndex + 512)`
 * drawOrder coercion in Android are preserved as the closest equivalents
 * supported by the JS StyleOptions.
 */
import {
  AbstractPolylineOverlayRenderer,
  densifyAndNormalize,
  type PolylineEntity,
  type PolylineState,
} from '@mapconductor/js-sdk-core';
import type { HereActualPolyline } from '../HereTypeAlias';
import { HereViewHolder } from '../HereViewHolder';
import { toGeoCoordinates } from '../GeoPoint';

export class HerePolylineOverlayRenderer extends AbstractPolylineOverlayRenderer<
  HereViewHolder,
  HereActualPolyline
> {
  override async createPolyline(state: PolylineState): Promise<HereActualPolyline | null> {
    const strip = createGeoStrip(state);
    const style = createStyle(state);
    const polyline = new H.map.Polyline(strip, {
      style,
      zIndex: coerceZIndex(state.zIndex),
      data: state.id,
    });
    this.holder.map.addObject(polyline);
    return polyline as HereActualPolyline;
  }

  override async updatePolylineProperties({
    polyline,
    current,
    prev,
  }: {
    polyline: HereActualPolyline;
    current: PolylineEntity<HereActualPolyline>;
    prev: PolylineEntity<HereActualPolyline>;
  }): Promise<HereActualPolyline | null> {
    const finger = current.fingerPrint;
    const prevFinger = prev.fingerPrint;

    if (finger.points !== prevFinger.points || finger.geodesic !== prevFinger.geodesic) {
      this.holder.map.removeObject(polyline);
      return await this.createPolyline(current.state);
    }

    if (
      finger.strokeColor !== prevFinger.strokeColor ||
      finger.strokeWidth !== prevFinger.strokeWidth
    ) {
      polyline.setStyle(createStyle(current.state));
    }

    if (finger.zIndex !== prevFinger.zIndex) {
      polyline.setZIndex(coerceZIndex(current.state.zIndex));
    }

    return polyline;
  }

  override async removePolyline(
    entity: PolylineEntity<HereActualPolyline>,
  ): Promise<void> {
    if (entity.polyline) this.holder.map.removeObject(entity.polyline);
  }
}

function createGeoStrip(state: PolylineState): H.geo.LineString {
  // Core pipeline: densify (great-circle when geodesic, linear lat/lng
  // otherwise — Android's straight-line semantics) and normalize into HERE's
  // [-180, 180] longitude range.
  const points = densifyAndNormalize(state.points, state.geodesic);
  const lineString = new H.geo.LineString();
  for (const point of points) {
    lineString.pushPoint(toGeoCoordinates(point));
  }
  return lineString as unknown as H.geo.LineString;
}

function createStyle(state: PolylineState): H.map.StyleOptions {
  return {
    strokeColor: state.strokeColor,
    lineWidth: state.strokeWidth,
    lineCap: 'square',
  };
}

function coerceZIndex(zIndex: number): number {
  // Mirrors `(state.zIndex + 512).coerceIn(512, 1023)` in Android.
  return Math.max(512, Math.min(1023, zIndex + 512));
}
