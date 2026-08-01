/**
 * Port of `HereCircleOverlayRenderer.kt` in
 * `android-for-here/.../circle/HereCircleOverlayRenderer.kt`.
 *
 * Like Android (which approximates the circle as a `MapPolygon`), the circle
 * is drawn as a polygon ring from the shared core geometry (`circleToRing`)
 * instead of the native `H.map.Circle`, so the circle shape definition
 * (geodesic vs planar) is unified across providers. The ring is unwrapped
 * around the center longitude; HERE JS accepts out-of-range longitudes
 * (verified against a ±180-crossing ring), so an antimeridian-crossing circle
 * stays continuous without normalize + splitRingByMeridian (splitting also
 * paints a stroke seam along the meridian).
 */
import {
  AbstractCircleOverlayRenderer,
  circleToRing,
  closeRing,
  type CircleEntity,
  type CircleState,
} from '@mapconductor/js-sdk-core';
import type { HereActualCircle } from '../HereTypeAlias';
import { HereViewHolder } from '../HereViewHolder';
import { toGeoCoordinates } from '../GeoPoint';

export class HereCircleOverlayRenderer extends AbstractCircleOverlayRenderer<
  HereViewHolder,
  HereActualCircle
> {
  override async createCircle(state: CircleState): Promise<HereActualCircle | null> {
    const geometry = buildCircleGeometry(state);
    if (!geometry) return null;
    const circle = new H.map.Polygon(geometry, {
      style: {
        strokeColor: state.strokeColor,
        fillColor: state.fillColor,
        lineWidth: state.strokeWidth,
      },
      zIndex: coerceZIndex(state.zIndex ?? 0),
      data: state.id,
    });
    this.holder.map.addObject(circle);
    return circle as HereActualCircle;
  }

  override async updateCircleProperties({
    circle,
    current,
    prev,
  }: {
    circle: HereActualCircle;
    current: CircleEntity<HereActualCircle>;
    prev: CircleEntity<HereActualCircle>;
  }): Promise<HereActualCircle | null> {
    const finger = current.fingerPrint;
    const prevFinger = prev.fingerPrint;

    if (
      finger.center !== prevFinger.center ||
      finger.radiusMeters !== prevFinger.radiusMeters ||
      finger.geodesic !== prevFinger.geodesic
    ) {
      // The polygon geometry cannot be mutated in place; rebuild the object
      // (mirrors HerePolygonOverlayRenderer's geometry-change path).
      this.holder.map.removeObject(circle);
      return await this.createCircle(current.state);
    }

    if (
      finger.strokeColor !== prevFinger.strokeColor ||
      finger.strokeWidth !== prevFinger.strokeWidth ||
      finger.fillColor !== prevFinger.fillColor
    ) {
      circle.setStyle({
        strokeColor: current.state.strokeColor,
        fillColor: current.state.fillColor,
        lineWidth: current.state.strokeWidth,
      });
    }

    if (finger.zIndex !== prevFinger.zIndex) {
      circle.setZIndex(coerceZIndex(current.state.zIndex ?? 0));
    }

    return circle;
  }

  override async removeCircle(
    entity: CircleEntity<HereActualCircle>,
  ): Promise<void> {
    if (entity.circle) this.holder.map.removeObject(entity.circle);
  }
}

function buildCircleGeometry(state: CircleState): H.geo.Polygon | null {
  const ring = closeRing(
    circleToRing(state.center, state.radiusMeters, state.geodesic),
  );
  if (ring.length < 4) return null;
  const lineString = new H.geo.LineString();
  for (const point of ring) {
    lineString.pushPoint(toGeoCoordinates(point));
  }
  return new H.geo.Polygon(lineString);
}

function coerceZIndex(zIndex: number): number {
  // Mirrors `(state.zIndex ?: 0).coerceIn(0, 511)` in Android.
  return Math.max(0, Math.min(511, zIndex));
}
