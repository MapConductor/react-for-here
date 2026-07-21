/**
 * Port of `HereCircleOverlayRenderer.kt` in
 * `android-for-here/.../circle/HereCircleOverlayRenderer.kt`.
 *
 * Android approximates the circle as a polygon because the HERE SDK for Mobile
 * lacks a dedicated circle primitive. The JS API exposes `H.map.Circle`, so
 * we use it directly while preserving the wrapper class name.
 */
import {
  AbstractCircleOverlayRenderer,
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
    const circle = new H.map.Circle(
      toGeoCoordinates(state.center),
      state.radiusMeters,
      {
        style: {
          strokeColor: state.strokeColor,
          fillColor: state.fillColor,
          lineWidth: state.strokeWidth,
        },
        zIndex: coerceZIndex(state.zIndex ?? 0),
        data: state.id,
      },
    );
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
      circle.setCenter(toGeoCoordinates(current.state.center));
      circle.setRadius(current.state.radiusMeters);
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

function coerceZIndex(zIndex: number): number {
  // Mirrors `(state.zIndex ?: 0).coerceIn(0, 511)` in Android.
  return Math.max(0, Math.min(511, zIndex));
}
