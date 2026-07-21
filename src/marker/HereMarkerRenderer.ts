/**
 * Port of `HereMarkerRenderer.kt` in
 * `android-for-here/.../marker/HereMarkerRenderer.kt`.
 *
 * The Android renderer uses `holder.mapView.mapScene.addMapMarkers(...)` and
 * `MapMarker` with `ImageFormat.PNG`/`Anchor2D`; here we use
 * `holder.map.addObject(new H.map.Marker(...))` with `H.Icon`/`H.math.Point`
 * anchor (see `BitmapIcon.ts` for the matching `toMapImage`/`toAnchor2D`).
 */
import {
  AbstractMarkerOverlayRenderer,
  type AddParams,
  type BitmapIcon,
  type ChangeParams,
  type GeoPoint,
  type MarkerEntity,
} from '@mapconductor/js-sdk-core';
import { MarkerManager } from '@mapconductor/js-sdk-core';
import type { HereActualMarker } from '../HereTypeAlias';
import { HereViewHolder } from '../HereViewHolder';
import { toAnchor2D, toMapImage } from '../BitmapIcon';
import { toGeoCoordinates } from '../GeoPoint';

const MARKER_METADATA_ID_KEY = 'mc:id';

function resolveDrawOrder(state: import('@mapconductor/js-sdk-core').MarkerState): number {
  if (state.zIndex !== 0) return state.zIndex;
  return Math.round(-state.position.latitude * 1_000_000 - state.position.longitude);
}

export class HereMarkerRenderer extends AbstractMarkerOverlayRenderer<
  HereViewHolder,
  HereActualMarker
> {
  readonly markerManager: MarkerManager<HereActualMarker>;

  constructor(holder: HereViewHolder) {
    super({ holder });
    // Mirrors `MarkerManager.defaultManager<HereActualMarker>(minMarkerCount = ...)`
    this.markerManager = MarkerManager.defaultManager<HereActualMarker>();
    // HERE JS H.map.Marker visibility can be toggled via setVisibility().
    this.supportsAnimationOverlay = true;
  }

  /**
   * Mirrors `onAdd(data: List<AddParamsInterface>): List<HereActualMarker?>`.
   * Each marker is constructed from its BitmapIcon and registered on the map.
   */
  override async onAdd(
    data: AddParams[],
  ): Promise<(HereActualMarker | null)[]> {
    const created = await Promise.all(
      data.map(async ({ state, bitmapIcon }) => {
        try {
          const icon = await toMapImage(bitmapIcon);
          const marker = new H.map.Marker(toGeoCoordinates(state.position), {
            icon,
            volatility: state.draggable,
            zIndex: resolveDrawOrder(state),
            data: { [MARKER_METADATA_ID_KEY]: state.id, extra: state.extra },
          });
          marker.draggable = state.draggable;
          this.holder.map.addObject(marker);
          return marker as HereActualMarker;
        } catch (error) {
          console.error('[MapConductor] Failed to create HERE marker', error);
          return null;
        }
      }),
    );
    return created;
  }

  /**
   * Mirrors `onChange(data): List<HereActualMarker?>`. Updates icon/position/
   * drawOrder on the existing marker (HERE JS lets us reuse the instance,
   * same as Android).
   */
  override async onChange(
    data: ChangeParams<HereActualMarker>[],
  ): Promise<(HereActualMarker | null)[]> {
    return Promise.all(
      data.map(async ({ current, prev, bitmapIcon }) => {
        const marker = current.marker;
        if (!marker) return null;
        if (!current.visible) return null;

        const prevFinger = prev.fingerPrint;
        const currFinger = current.fingerPrint;
        if (currFinger.icon !== prevFinger.icon) {
          try {
            marker.setIcon(await toMapImage(bitmapIcon));
          } catch (error) {
            console.error('[MapConductor] Failed to update marker icon', error);
          }
        }
        marker.setGeometry(toGeoCoordinates(current.state.position));
        marker.setZIndex(resolveDrawOrder(current.state));
        if (currFinger.draggable !== prevFinger.draggable) {
          marker.draggable = current.state.draggable;
        }
        return marker;
      }),
    );
  }

  /** Mirrors `onRemove(data: List<MarkerEntity<HereActualMarker>>)`. */
  override async onRemove(data: MarkerEntity<HereActualMarker>[]): Promise<void> {
    const markers = data
      .map((entity) => entity.marker)
      .filter((m): m is HereActualMarker => m != null);
    if (markers.length > 0) {
      this.holder.map.removeObjects(markers);
    }
  }

  /** Mirrors `onPostProcess()` — HERE JS has no batch post-processing step. */
  override async onPostProcess(): Promise<void> {}

  /** Mirrors `setMarkerPosition(entity, position)`. */
  override setMarkerPosition(
    entity: MarkerEntity<HereActualMarker>,
    position: GeoPoint,
  ): void {
    entity.marker?.setGeometry(toGeoCoordinates(position));
  }

  /**
   * Mirrors `setMarkerVisible(entity, visible)`. Android re-adds/removes the
   * marker because `MapMarker` has no visibility property; HERE JS does, so
   * toggle it directly.
   */
  override setMarkerVisible(
    entity: MarkerEntity<HereActualMarker>,
    visible: boolean,
  ): void {
    entity.marker?.setVisibility(visible);
  }
}

export function anchorToHPoint(bitmapIcon: BitmapIcon): H.math.Point<number> {
  return toAnchor2D(bitmapIcon);
}
