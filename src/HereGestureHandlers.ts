import { createGeoPoint } from '@mapconductor/js-sdk-core';
import type {
  GeoPoint,
  MapCameraPosition,
  MapUISettings,
} from '@mapconductor/js-sdk-core';
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
  onMapLongClick(point: GeoPoint): void;
}

export function handleMapClick(deps: GestureDeps, event: H.map.MapEvent): void {
  const point = toGeoPointFromEvent(deps, event);
  if (!point) return;

  const markerEntity = deps.markerController.find(point);
  if (markerEntity?.state.clickable) {
    deps.markerController.dispatchClick(markerEntity.state);
    return;
  }

  // Tiled markers are drawn into a raster overlay (no H.map.Marker to receive
  // a tap, so find() above returns null for them); hit-test them here.
  const tiled = deps.markerController.findTiled(point, deps.getCameraPosition()?.zoom ?? 0);
  if (tiled?.state.clickable) {
    deps.markerController.dispatchClick(tiled.state);
    return;
  }

  const circleEntity = deps.circleController.find(point);
  if (circleEntity) {
    deps.circleController.dispatchClick({ state: circleEntity.state, clicked: point });
    return;
  }

  const polylineHit = deps.polylineController.findWithClosestPoint(point);
  if (polylineHit) {
    deps.polylineController.dispatchClick({
      state: polylineHit.entity.state,
      clicked: polylineHit.closestPoint,
    });
    return;
  }

  const polygonEntity = deps.polygonController.find(point);
  if (polygonEntity) {
    deps.polygonController.dispatchClick({ state: polygonEntity.state, clicked: point });
    return;
  }

  deps.onMapClick(point);
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
  if (deps.getVisualTilt() > 0.5 || Math.abs(deps.getVisualBearing()) > 0.01) {
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
