/**
 * Port of `HereViewHolder.kt` in `android-for-here/.../HereViewHolder.kt`.
 *
 * The Android holder wraps `MapView`/`MapScene`; here it wraps the HERE Maps
 * API for JavaScript `H.Map` (and exposes its underlying element via the
 * `mapView` field like the sibling providers).
 */
import {
  MapViewHolderBase,
  createGeoPoint,
  type GeoPoint,
  type GeoPointInterface,
  type Offset,
} from '@mapconductor/js-sdk-core';
import { toGeoCoordinates, toGeoPoint } from './GeoPoint';
import type { HereMapViewController } from './HereMapViewController';

export class HereViewHolder extends MapViewHolderBase<HTMLElement, H.Map> {
  private controller: HereMapViewController | null = null;

  constructor(
    readonly mapView: HTMLElement,
    readonly map: H.Map,
    readonly behavior: H.mapevents.Behavior,
  ) {
    super();
  }

  setController(controller: HereMapViewController): void {
    this.controller = controller;
  }

  /**
   * Mirrors `toScreenOffset(position: GeoPointInterface): Offset?` in Android.
   */
  override toScreenOffset(position: GeoPointInterface): Offset {
    const point = this.map.geoToScreen(toGeoCoordinates(position));
    return this.mapPixelToViewport({ x: point.x, y: point.y });
  }

  /**
   * Mirrors `fromScreenOffsetSync(offset: Offset): GeoPoint?` in Android.
   */
  override fromScreenOffsetSync(offset: Offset): GeoPoint | null {
    const point = this.viewportToMapPixel(offset);
    const coord = this.map.screenToGeo(point.x, point.y);
    if (!coord) return null;
    return toGeoPoint(coord);
  }

  /** Convenience helper that mirrors `GeoPoint.from(...)` usage in Android. */
  geoToScreen(position: GeoPointInterface): Offset {
    return this.toScreenOffset(position);
  }

  private mapPixelToViewport(offset: Offset): Offset {
    const mapWidth = this.mapView.clientWidth;
    const mapHeight = this.mapView.clientHeight;
    const viewport = this.mapView.parentElement;
    const viewportWidth = viewport?.clientWidth ?? mapWidth;
    const viewportHeight = viewport?.clientHeight ?? mapHeight;
    const bearing = -(this.controller?.getVisualBearing() ?? 0) * Math.PI / 180;
    const tiltScale = Math.cos((this.controller?.getVisualTilt() ?? 0) * Math.PI / 180);
    const x = offset.x - mapWidth / 2;
    const y = (offset.y - mapHeight / 2) * tiltScale;
    return {
      x: viewportWidth / 2 + x * Math.cos(bearing) - y * Math.sin(bearing),
      y: viewportHeight / 2 + x * Math.sin(bearing) + y * Math.cos(bearing),
    };
  }

  private viewportToMapPixel(offset: Offset): Offset {
    const mapWidth = this.mapView.clientWidth;
    const mapHeight = this.mapView.clientHeight;
    const viewport = this.mapView.parentElement;
    const viewportWidth = viewport?.clientWidth ?? mapWidth;
    const viewportHeight = viewport?.clientHeight ?? mapHeight;
    const bearing = (this.controller?.getVisualBearing() ?? 0) * Math.PI / 180;
    const tiltScale = Math.max(Math.cos((this.controller?.getVisualTilt() ?? 0) * Math.PI / 180), 0.01);
    const x = offset.x - viewportWidth / 2;
    const y = offset.y - viewportHeight / 2;
    return {
      x: mapWidth / 2 + x * Math.cos(bearing) - y * Math.sin(bearing),
      y: mapHeight / 2 + (x * Math.sin(bearing) + y * Math.cos(bearing)) / tiltScale,
    };
  }
}

export function createGeoPointFromHere(coord: H.geo.GeoCoord): GeoPoint {
  return createGeoPoint({ latitude: coord.lat, longitude: coord.lng, altitude: coord.alt });
}
