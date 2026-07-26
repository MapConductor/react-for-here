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

  /**
   * Whether the native HERE canvas markers should be visible. The 2D view
   * fakes camera tilt with a CSS `rotateX` on the map container, which lays
   * the canvas-drawn marker icons flat against the ground. While tilted the
   * view hides these native markers (via `setNativeVisible(false)`) and draws
   * upright, billboarded DOM icons instead. New markers created while hidden
   * must inherit this state, so onAdd applies it too.
   */
  private nativeVisible = true;

  constructor(holder: HereViewHolder) {
    super({ holder });
    // Mirrors `MarkerManager.defaultManager<HereActualMarker>(minMarkerCount = ...)`
    this.markerManager = MarkerManager.defaultManager<HereActualMarker>();
    // HERE JS H.map.Marker visibility can be toggled via setVisibility().
    this.supportsAnimationOverlay = true;
  }

  /** Whether native markers should currently be visible (see `nativeVisible`). */
  get isNativeVisible(): boolean {
    return this.nativeVisible;
  }

  /**
   * Remembers whether native markers should be visible so that markers added
   * afterwards (see onAdd) inherit the state. NOTE: this renderer does not own
   * the live marker entities — they live in the controller's MarkerManager — so
   * toggling the visibility of existing markers is done by the controller
   * (HereMarkerController.setNativeMarkersVisible), not here.
   */
  setNativeVisible(visible: boolean): void {
    this.nativeVisible = visible;
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
          // Inherit the current native-visibility state (see nativeVisible).
          if (!this.nativeVisible) marker.setVisibility(false);
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
    // The marker-animation overlay hides the native marker during a Drop/Bounce
    // and restores it afterwards. While the CSS tilt hack is active, native
    // markers must stay hidden (billboards are drawn instead), so never let the
    // restore re-show a native marker while `nativeVisible` is false.
    entity.marker?.setVisibility(visible && this.nativeVisible);
  }
}

export function anchorToHPoint(bitmapIcon: BitmapIcon): H.math.Point<number> {
  return toAnchor2D(bitmapIcon);
}
