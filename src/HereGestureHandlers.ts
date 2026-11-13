import { createGeoPoint } from '@mapconductor/js-sdk-core';
import type {
  GeoPoint,
  MapCameraPosition,
  MapUISettings,
  MarkerEntity,
  Offset,
} from '@mapconductor/js-sdk-core';
import type { HereActualMarker } from './HereTypeAlias';
import type { HereViewHolder } from './HereViewHolder';
import type { HereMarkerController } from './marker/HereMarkerController';
import type { HereCircleController } from './circle/HereCircleController';
import type { HerePolylineController } from './polyline/HerePolylineController';
import type { HerePolygonController } from './polygon/HerePolygonController';

/**
 * タップ・長押しとマーカーのドラッグ。
 *
 * HERE JS API はマーカーのドラッグを持たないので、ドラッグ中だけ地図の
 * パンを切って自前で座標を差し替えている（[dragOffset] が掴んだ位置のずれ）。
 * タップは**マーカーが先**で、タイル描画のマーカー → circle → polyline →
 * polygon の順に当たり判定を通し、どれにも当たらなかったときだけ
 * `onMapClick` を呼ぶ（android と同じ順序）。
 */
export interface GestureDeps {
  readonly holder: HereViewHolder;
  readonly markerController: HereMarkerController;
  readonly circleController: HereCircleController;
  readonly polylineController: HerePolylineController;
  readonly polygonController: HerePolygonController;
  readonly uiSettings: MapUISettings;
  /** ドラッグ中だけ使う、掴んだ点とマーカー中心のずれ。 */
  readonly dragOffset: { current: { x: number; y: number } | null };
  getCameraPosition(): MapCameraPosition | null;
  getVisualTilt(): number;
  getVisualBearing(): number;
  applyUISettings(settings: MapUISettings): void;
  onMapClick(point: GeoPoint): void;

  /**
   * タップの配送。コアの `BaseMapViewController.dispatchTap` を呼ぶ。
   * marker → circle → groundImage → polyline → polygon → map を 1 つだけ配送する。
   */
  dispatchTap(point: GeoPoint): boolean;
  onMapLongClick(point: GeoPoint): void;
}

export function handleMapClick(deps: GestureDeps, event: H.map.MapEvent): void {
  const point = toGeoPointFromEvent(deps, event);
  if (!point) return;
  // A finger gets slop around a marker, a mouse none (see HereMarkerController.find).
  deps.markerController.pointerType = event.currentPointer?.type === 'touch' ? 'touch' : 'mouse';

  // marker → circle → groundImage → polyline → polygon → map の一本道。
  // 順序と先勝ちはコアの BaseMapViewController.dispatchTap が持つ。
  deps.dispatchTap(point);
}

export function handleMapLongClick(deps: GestureDeps, event: H.map.MapEvent): void {
  const point = toGeoPointFromEvent(deps, event);
  if (!point) return;
  deps.onMapLongClick(point);
}

export function handleMarkerDragStart(deps: GestureDeps, event: H.map.MapEvent): void {
  const pointer = event.currentPointer;
  if (!pointer || !(event.target instanceof H.map.Marker)) return;
  const entity = deps.markerController.findByMarker(event.target);
  if (!entity?.state.draggable || !entity.marker) return;

  const markerPoint = deps.holder.map.geoToScreen(entity.marker.getGeometry());
  deps.dragOffset.current = {
    x: pointer.viewportX - markerPoint.x,
    y: pointer.viewportY - markerPoint.y,
  };
  deps.markerController.setSelectedMarker(entity);
  deps.markerController.setDraggingState(entity.state, true);
  deps.holder.behavior.disable();
  deps.markerController.dispatchDragStart(entity.state);
}

export function handleMarkerDrag(deps: GestureDeps, event: H.map.MapEvent): void {
  const entity = deps.markerController.selectedMarker;
  const pointer = event.currentPointer;
  const offset = deps.dragOffset.current;
  if (!entity?.marker || !pointer || !offset) return;

  const coord = deps.holder.map.screenToGeo(
    pointer.viewportX - offset.x,
    pointer.viewportY - offset.y,
  );
  if (!coord) return;
  const position = createGeoPoint({ latitude: coord.lat, longitude: coord.lng });
  deps.markerController.renderer.setMarkerPosition(entity, position);
  deps.markerController.applyDragPosition(entity.state, position);
  deps.markerController.dispatchDrag(entity.state);
}

export function handleMarkerDragEnd(deps: GestureDeps, event: H.map.MapEvent): void {
  const entity = deps.markerController.selectedMarker;
  if (!entity) return;

  handleMarkerDrag(deps, event);
  deps.markerController.setDraggingState(entity.state, false);
  deps.markerController.dispatchDragEnd(entity.state);
  deps.markerController.setSelectedMarker(null);
  deps.dragOffset.current = null;
  deps.holder.behavior.enable();
  // `enable()` turns every gesture back on, including any the app disabled.
  deps.applyUISettings(deps.uiSettings);
}

export function toGeoPointFromEvent(deps: GestureDeps, event: H.map.MapEvent): GeoPoint | null {
  const pointer = event.currentPointer;
  if (!pointer) return null;
  // While the 2D view fakes tilt/bearing with a CSS transform on the map
  // plane, HERE's native screenToGeo (which ignores that transform) returns
  // the wrong coordinate for taps — the error is zero at the plane's centre
  // and grows toward the edges. Reproject through the holder's tilt-aware
  // inverse, using the tap position in the OUTER container's coordinate space
  // (derived from the raw DOM event so it is unaffected by the transform).
  if (isPlaneTransformed(deps)) {
    const outer = deps.holder.mapView.parentElement;
    const originalEvent = (event as unknown as { originalEvent?: { clientX?: number; clientY?: number } }).originalEvent;
    const clientX = originalEvent?.clientX;
    const clientY = originalEvent?.clientY;
    if (outer && typeof clientX === 'number' && typeof clientY === 'number') {
      const rect = outer.getBoundingClientRect();
      return deps.holder.fromScreenOffsetSync({ x: clientX - rect.left, y: clientY - rect.top });
    }
  }
  // Flat & north-up: the plane is 1:1 with the container, so the native
  // projection is correct (and cheaper).
  const coord = deps.holder.map.screenToGeo(pointer.viewportX, pointer.viewportY);
  if (!coord) return null;
  return createGeoPoint({ latitude: coord.lat, longitude: coord.lng });
}

/** Pointer travel before a press on a marker becomes a drag (a tap below it). */
const DRAG_SLOP_PX = 4;

/** Zoom levels for one wheel event: a mouse notch is about one level. */
function wheelZoomDelta(event: WheelEvent): number {
  const pixels = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
  return Math.max(-1, Math.min(1, -pixels / 100));
}

function isPlaneTransformed(deps: GestureDeps): boolean {
  return deps.getVisualTilt() > 0.5 || Math.abs(deps.getVisualBearing()) > 0.01;
}

/**
 * Pans, wheel-zooms and drags markers by hand while the 2D view fakes
 * tilt/bearing with a CSS transform on the map plane.
 *
 * HERE's own panning and wheel zoom read the pointer in the plane's
 * untransformed pixels, so on a rotated map the map slides off at the
 * bearing's angle and zooms toward the wrong point. The native markers are
 * hidden meanwhile (upright billboards are drawn instead), so their drag
 * cannot start either. While the plane is transformed:
 *
 * - a press on a draggable marker drags it, keeping the grab offset on
 *   screen, once the pointer has moved past [DRAG_SLOP_PX];
 * - any other press pans, keeping the grabbed ground point under the pointer;
 * - the wheel zooms about the ground under the cursor.
 *
 * A flat, north-up map keeps HERE's own gestures (with their inertia).
 * Listens in the capture phase on the plane's parent so it runs before HERE's
 * own pointer handling. Returns the uninstaller.
 */
export function installTransformedGestures(getDeps: () => GestureDeps): () => void {
  const outer = getDeps().holder.mapView.parentElement;
  if (!outer) return () => {};
  let pointerId: number | null = null;
  let down: Offset | null = null;
  // Pan: the ground point grabbed. Marker drag: the marker and the pointer's
  // offset from its anchor on screen.
  let anchor: GeoPoint | null = null;
  let marker: { entity: MarkerEntity<HereActualMarker>; grab: Offset; started: boolean } | null = null;

  const screenOffset = (event: MouseEvent): Offset => {
    const rect = outer.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const end = () => {
    if (pointerId == null) return;
    pointerId = null;
    down = null;
    anchor = null;
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    const deps = getDeps();
    if (marker?.started) deps.markerController.endScreenDrag(marker.entity.state);
    marker = null;
    // Hand the gestures back to HERE, as far as the app's settings allow.
    deps.applyUISettings(deps.uiSettings);
  };

  // Moves the map so that `ground` sits under the outer-container point `at`.
  const keepUnder = (ground: GeoPoint, at: Offset) => {
    const { holder } = getDeps();
    const under = holder.fromScreenOffsetSync(at);
    if (!under) return;
    // Both points in the plane's own pixels: move the centre by the gap
    // between where the anchor is and where the pointer now is.
    const map = holder.map;
    const anchorPx = map.geoToScreen({ lat: ground.latitude, lng: ground.longitude });
    const pointerPx = map.geoToScreen({ lat: under.latitude, lng: under.longitude });
    if (!anchorPx || !pointerPx) return;
    const center = map.screenToGeo(
      holder.mapView.clientWidth / 2 + anchorPx.x - pointerPx.x,
      holder.mapView.clientHeight / 2 + anchorPx.y - pointerPx.y,
    );
    if (center) map.setCenter(center);
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const at = screenOffset(event);
    if (marker) {
      const deps = getDeps();
      if (!marker.started) {
        if (!down || Math.hypot(at.x - down.x, at.y - down.y) < DRAG_SLOP_PX) return;
        marker.started = true;
        deps.markerController.beginScreenDrag(marker.entity.state);
      }
      const position = deps.holder.fromScreenOffsetSync({ x: at.x - marker.grab.x, y: at.y - marker.grab.y });
      if (position) deps.markerController.moveScreenDrag(marker.entity.state, position);
      return;
    }
    if (anchor) keepUnder(anchor, at);
  };

  // HERE's wheel zoom anchors on the pointer read the same untransformed way,
  // so it zooms toward the wrong point; zoom about the ground under the cursor.
  const onWheel = (event: WheelEvent) => {
    const deps = getDeps();
    if (!deps.uiSettings.zoomGesture || !isPlaneTransformed(deps)) return;
    event.preventDefault();
    event.stopPropagation();
    const at = screenOffset(event);
    const ground = deps.holder.fromScreenOffsetSync(at);
    if (!ground) return;
    const map = deps.holder.map;
    map.setZoom(map.getZoom() + wheelZoomDelta(event));
    keepUnder(ground, at);
  };

  const onUp = (event: PointerEvent) => {
    if (event.pointerId === pointerId) end();
  };

  // A draggable, non-tiled marker under the pointer, drawn as a billboard.
  const draggableAt = (deps: GestureDeps, ground: GeoPoint, pointerType: string) => {
    deps.markerController.pointerType = pointerType === 'touch' ? 'touch' : 'mouse';
    const entity = deps.markerController.find(ground);
    return entity && !entity.tiling && entity.state.draggable ? entity : null;
  };

  const onDown = (event: PointerEvent) => {
    if (pointerId != null) {
      // A second finger: leave the gesture (pinch) to HERE.
      end();
      return;
    }
    if (!event.isPrimary || event.button !== 0) return;
    const deps = getDeps();
    if (!isPlaneTransformed(deps)) return;
    const at = screenOffset(event);
    const grabbed = deps.holder.fromScreenOffsetSync(at);
    if (!grabbed) return;
    const entity = draggableAt(deps, grabbed, event.pointerType);
    if (entity) {
      const anchorScreen = deps.holder.toScreenOffset(entity.state.position);
      marker = { entity, grab: { x: at.x - anchorScreen.x, y: at.y - anchorScreen.y }, started: false };
    } else if (deps.uiSettings.scrollGesture) {
      anchor = grabbed;
    } else {
      return;
    }
    pointerId = event.pointerId;
    down = at;
    deps.holder.behavior.disable(H.mapevents.Behavior.Feature.PANNING);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  };

  outer.addEventListener('pointerdown', onDown, true);
  outer.addEventListener('wheel', onWheel, { capture: true, passive: false });
  return () => {
    end();
    outer.removeEventListener('pointerdown', onDown, true);
    outer.removeEventListener('wheel', onWheel, true);
  };
}
