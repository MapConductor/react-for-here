/**
 * Port of `HereMapViewController.kt` in
 * `android-for-here/.../HereMapViewController.kt`.
 *
 *   class HereMapViewController(
 *       private val markerController: HereMarkerController,
 *       private val polylineController: HerePolylineController,
 *       private val polygonController: HerePolygonController,
 *       private val groundImageController: HereGroundImageController,
 *       private val circleController: HereCircleController,
 *       private val rasterLayerController: HereRasterLayerController,
 *       override val holder: HereViewHolder,
 *       override val defaultCoroutine: CoroutineScope = ...,
 *       override val mainCoroutine: CoroutineScope = ...,
 *   ) : BaseMapViewController(),
 *       CircleCapableInterface,
 *       HereMapViewControllerInterface,
 *       MapCameraListener,
 *       TapListener,
 *       LongPressListener
 *
 * The HERE JS API provides continuous `mapviewchange` / `mapviewchangeend`
 * events (no separate "move end" callback); Android synthesizes a "move end"
 * via an idle job (CAMERA_MOVE_END_IDLE_MS = 120L). We replicate that here.
 */
import {
  BaseMapViewController,
  createGeoPoint,
  createGeoRectBounds,
  type CameraOptions,
  type CircleState,
  type GeoPoint,
  type GeoRectBounds,
  type GroundImageState,
  type MapCameraPosition,
  type MapViewControllerInterface,
  type MarkerState,
  type OnCircleEventHandler,
  type OnGroundImageEventHandler,
  type OnMapEventHandler,
  type OnMapInitializedHandler,
  type OnMarkerEventHandler,
  type OnPolygonEventHandler,
  type OnPolylineEventHandler,
  type PolygonState,
  type PolylineState,
  type RasterLayerState,
  type VisibleRegion,
} from '@mapconductor/js-sdk-core';
import type { HereMapDesignType } from './HereMapDesign';
import type {
  HereMapDesignTypeChangeHandler,
  HereMapViewControllerInterface,
} from './HereMapViewControllerInterface';
import { HereViewHolder } from './HereViewHolder';
import {
  mapCameraPositionFrom,
  toHereLookAtData,
} from './MapCameraPosition';
import { toGeoPoint } from './GeoPoint';
import { toGeoRect } from './GeoRectBounds';
import { getHerePlatform } from './HereViewControllerStore';
import { HereMarkerController } from './marker/HereMarkerController';
import { HerePolylineController } from './polyline/HerePolylineController';
import { HerePolygonController } from './polygon/HerePolygonController';
import { HereCircleController } from './circle/HereCircleController';
import { HereGroundImageController } from './groundimage/HereGroundImageController';
import { HereRasterLayerController } from './raster/HereRasterLayerController';

const CAMERA_MOVE_END_IDLE_MS = 120;

export class HereMapViewController
  extends BaseMapViewController
  implements HereMapViewControllerInterface, MapViewControllerInterface
{
  readonly holder: HereViewHolder;

  private readonly markerController: HereMarkerController;
  private readonly polylineController: HerePolylineController;
  private readonly polygonController: HerePolygonController;
  private readonly groundImageController: HereGroundImageController;
  private readonly circleController: HereCircleController;
  private readonly rasterLayerController: HereRasterLayerController;
  private readonly minZoom?: number;
  private readonly maxZoom?: number;
  private readonly restrictBounds?: GeoRectBounds;

  private initialized = false;
  private destroyed = false;
  private logicalTilt = 0;
  private logicalPosition = createGeoPoint({ latitude: 0, longitude: 0 });
  private logicalZoom = 0;
  private logicalBearing = 0;
  private isAnimatingCamera = false;
  private cameraMoveInProgress = false;
  private cameraMoveEndTimer: ReturnType<typeof setTimeout> | null = null;
  private constraintFrame: number | null = null;
  private lastReportedCamera: MapCameraPosition | null = null;

  private mapDesignType: HereMapDesignType;
  private mapDesignTypeChangeListener: HereMapDesignTypeChangeHandler | null = null;
  private markerDragOffset: { x: number; y: number } | null = null;

  private readonly onMapChangeHandler = () => this.onMapChange();
  private readonly onMapChangeEndHandler = () => this.onMapChangeEnd();
  private readonly onMapClickHandler = (event: H.map.MapEvent) => this.onMapClick(event);
  private readonly onMapLongClickHandler = (event: H.map.MapEvent) => this.onMapLongClick(event);
  private readonly onMarkerDragStartHandler = (event: H.map.MapEvent) =>
    this.onMarkerDragStart(event);
  private readonly onMarkerDragHandler = (event: H.map.MapEvent) => this.onMarkerDrag(event);
  private readonly onMarkerDragEndHandler = (event: H.map.MapEvent) => this.onMarkerDragEnd(event);

  constructor({
    holder,
    initialMapDesignType,
    markerController,
    polylineController,
    polygonController,
    groundImageController,
    circleController,
    rasterLayerController,
    minZoom,
    maxZoom,
    restrictBounds,
  }: {
    holder: HereViewHolder;
    initialMapDesignType: HereMapDesignType;
    markerController: HereMarkerController;
    polylineController: HerePolylineController;
    polygonController: HerePolygonController;
    groundImageController: HereGroundImageController;
    circleController: HereCircleController;
    rasterLayerController: HereRasterLayerController;
    minZoom?: number;
    maxZoom?: number;
    restrictBounds?: GeoRectBounds;
  }) {
    super();
    this.holder = holder;
    this.markerController = markerController;
    this.polylineController = polylineController;
    this.polygonController = polygonController;
    this.groundImageController = groundImageController;
    this.circleController = circleController;
    this.rasterLayerController = rasterLayerController;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.restrictBounds = restrictBounds;
    this.mapDesignType = initialMapDesignType;
    // Tiled markers render into a raster overlay driven by the raster controller.
    this.markerController.onRasterLayerUpdate = async state => {
      if (state) await this.rasterLayerController.composition([state]);
      else await this.rasterLayerController.clear();
    };
    const initialLookAt = holder.map.getViewModel().getLookAtData();
    this.logicalPosition = toGeoPoint(initialLookAt.position);
    this.logicalZoom = initialLookAt.zoom;
    holder.setController(this);
    this.setupListeners();
    this.enforceCameraConstraints();
    const camera = this.getCameraPosition();
    if (camera) void this.notifyControllersCameraChanged(camera);
  }

  // ----- setup ---------------------------------------------------------------

  /**
   * Mirrors `setupListeners()` in Android.
   *
   * HERE Maps API for JavaScript emits only `mapviewchange` (continuous) and
   * `mapviewchangeend`; there is no dedicated "movestart" event. We synthesize
   * it by detecting the transition from idle to moving.
   */
  private setupListeners(): void {
    const map = this.holder.map;
    map.addEventListener('mapviewchange', this.onMapChangeHandler as never);
    map.addEventListener('mapviewchangeend', this.onMapChangeEndHandler as never);
    map.addEventListener('tap', this.onMapClickHandler as never);
    map.addEventListener('longpress', this.onMapLongClickHandler as never);
    map.addEventListener('dragstart', this.onMarkerDragStartHandler as never);
    map.addEventListener('drag', this.onMarkerDragHandler as never);
    map.addEventListener('dragend', this.onMarkerDragEndHandler as never);
  }

  private detachListeners(): void {
    const map = this.holder.map;
    map.removeEventListener('mapviewchange', this.onMapChangeHandler as never);
    map.removeEventListener('mapviewchangeend', this.onMapChangeEndHandler as never);
    map.removeEventListener('tap', this.onMapClickHandler as never);
    map.removeEventListener('longpress', this.onMapLongClickHandler as never);
    map.removeEventListener('dragstart', this.onMarkerDragStartHandler as never);
    map.removeEventListener('drag', this.onMarkerDragHandler as never);
    map.removeEventListener('dragend', this.onMarkerDragEndHandler as never);
  }

  // ----- camera (mirrors moveCamera / animateCamera / fitBounds) -------------

  getVisualTilt(): number { return Math.min(60, Math.abs(this.logicalTilt)); }

  getVisualBearing(): number { return this.logicalBearing; }

  moveCamera(position: MapCameraPosition): Promise<boolean> {
    this.setLogicalCamera(position);
    const lookAt = this.constrainLookAt(toHereLookAtData(position));
    this.holder.map.getViewModel().setLookAtData(lookAt, false);
    return Promise.resolve(true);
  }

  animateCamera(position: MapCameraPosition, _options?: CameraOptions): Promise<boolean> {
    this.setLogicalCamera(position);
    const lookAt = this.constrainLookAt(toHereLookAtData(position));
    this.isAnimatingCamera = true;
    this.holder.map.getViewModel().setLookAtData(lookAt, true);
    // HERE JS does not expose an animation-end callback on setLookAtData
    // directly. Recover via the next mapviewchangeend event.
    const map = this.holder.map;
    const handler = () => {
      map.removeEventListener('mapviewchangeend', handler as never);
      this.isAnimatingCamera = false;
      const camera = this.getCameraPosition();
      if (camera) this.notifyCameraMoveEnd(camera);
    };
    map.addEventListener('mapviewchangeend', handler as never);
    return Promise.resolve(true);
  }

  fitBounds(bounds: GeoRectBounds, _options?: CameraOptions): Promise<boolean> {
    const rect = toGeoRect(bounds);
    if (!rect) return Promise.resolve(false);
    this.holder.map.getViewModel().setLookAtData({ bounds: rect }, false);
    return Promise.resolve(true);
  }

  getCameraPosition(): MapCameraPosition | null {
    const lookAt = this.holder.map.getViewModel().getLookAtData();
    const usesNegativeTiltOffset = this.logicalTilt < 0;
    const logical = mapCameraPositionFrom({
      position: usesNegativeTiltOffset ? this.logicalPosition : toGeoPoint(lookAt.position),
      zoom: usesNegativeTiltOffset ? this.logicalZoom : lookAt.zoom,
      bearing: this.logicalBearing,
      tilt: this.logicalTilt,
    });
    const visibleRegion = this.getVisibleRegion();
    return visibleRegion ? logical.copy({ visibleRegion }) : logical;
  }

  getBounds(): GeoRectBounds | null {
    return this.getVisibleRegion()?.bounds ?? null;
  }

  /**
   * Mirrors `getMapCameraPosition(cameraState)` in Android: projects the four
   * screen corners back to geo coordinates instead of using
   * `map.getBounds()`'s axis-aligned box, so the visible region stays correct
   * when the map is rotated.
   */
  private getVisibleRegion(): VisibleRegion | null {
    const viewport = this.holder.mapView.parentElement;
    const width = viewport?.clientWidth ?? this.holder.map.getViewPort().width;
    const height = viewport?.clientHeight ?? this.holder.map.getViewPort().height;
    if (!width || !height) return null;

    const nearLeft = this.holder.fromScreenOffsetSync({ x: 0, y: height });
    const nearRight = this.holder.fromScreenOffsetSync({ x: width, y: height });
    const farLeft = this.holder.fromScreenOffsetSync({ x: 0, y: 0 });
    const farRight = this.holder.fromScreenOffsetSync({ x: width, y: 0 });
    if (!nearLeft || !nearRight || !farLeft || !farRight) return null;

    const bounds = createGeoRectBounds();
    bounds.extend(nearLeft);
    bounds.extend(nearRight);
    bounds.extend(farLeft);
    bounds.extend(farRight);

    return { bounds, nearLeft, nearRight, farLeft, farRight };
  }

  private setLogicalCamera(position: MapCameraPosition): void {
    this.logicalTilt = position.tilt;
    this.logicalPosition = position.position;
    this.logicalZoom = position.zoom;
    this.logicalBearing = position.bearing;
  }

  // ----- camera change listeners (mirror onMapCameraUpdated) -----------------

  private onMapChange(): void {
    if (this.enforceCameraConstraints()) return;
    const camera = this.getCameraPosition();
    if (!camera) return;
    this.lastReportedCamera = camera;
    if (this.isAnimatingCamera) return;

    // Synthesize "move start" on the first continuous change after an idle
    // period (HERE JS has no dedicated mapviewchangestart event).
    if (!this.cameraMoveInProgress) {
      this.cameraMoveInProgress = true;
      this.notifyCameraMoveStart(camera);
    }
    this.notifyCameraMove(camera);
  }

  private onMapChangeEnd(): void {
    if (this.enforceCameraConstraints()) return;
    if (this.isAnimatingCamera) return;
    if (this.cameraMoveEndTimer != null) clearTimeout(this.cameraMoveEndTimer);
    this.cameraMoveEndTimer = setTimeout(() => {
      this.cameraMoveEndTimer = null;
      const camera = this.lastReportedCamera ?? this.getCameraPosition();
      if (!camera) return;
      this.cameraMoveInProgress = false;
      void this.notifyControllersCameraChanged(camera);
      this.notifyCameraMoveEnd(camera);
    }, CAMERA_MOVE_END_IDLE_MS);
  }

  private async notifyControllersCameraChanged(camera: MapCameraPosition): Promise<void> {
    await Promise.all([
      this.markerController.onCameraChanged(camera),
      this.circleController.onCameraChanged(camera),
      this.polylineController.onCameraChanged(camera),
      this.polygonController.onCameraChanged(camera),
      this.groundImageController.onCameraChanged(camera),
      this.rasterLayerController.onCameraChanged(camera),
    ]);
  }

  private constrainLookAt(data: H.map.ViewLookAtData): H.map.ViewLookAtData {
    const bounds = this.restrictBounds;
    const position = data.position;
    return {
      ...data,
      ...(data.zoom !== undefined
        ? { zoom: clamp(data.zoom, this.minZoom, this.maxZoom) }
        : {}),
      ...(position && bounds?.southWest && bounds.northEast
        ? {
            position: {
              ...position,
              lat: clamp(position.lat, bounds.southWest.latitude, bounds.northEast.latitude),
              lng: clamp(position.lng, bounds.southWest.longitude, bounds.northEast.longitude),
            },
          }
        : {}),
    };
  }

  /** Keeps both the camera target and the complete visible region in bounds. */
  private enforceCameraConstraints(): boolean {
    const map = this.holder.map;
    const lookAt = map.getViewModel().getLookAtData();
    const constrained = this.constrainLookAt(lookAt);
    if (
      constrained.zoom !== lookAt.zoom ||
      constrained.position?.lat !== lookAt.position.lat ||
      constrained.position?.lng !== lookAt.position.lng
    ) {
      map.getViewModel().setLookAtData(constrained, false);
      this.scheduleConstraintCheck();
      return true;
    }

    const restrict = this.restrictBounds;
    const visible = this.getVisibleRegion()?.bounds;
    if (!restrict?.southWest || !restrict.northEast || !visible?.southWest || !visible.northEast) {
      return false;
    }

    const visibleLatSpan = visible.northEast.latitude - visible.southWest.latitude;
    const visibleLngSpan = visible.northEast.longitude - visible.southWest.longitude;
    const restrictLatSpan = restrict.northEast.latitude - restrict.southWest.latitude;
    const restrictLngSpan = restrict.northEast.longitude - restrict.southWest.longitude;
    if (visibleLatSpan > restrictLatSpan || visibleLngSpan > restrictLngSpan) {
      const rect = toGeoRect(restrict);
      if (rect) map.getViewModel().setLookAtData({ bounds: rect }, false);
      return rect != null;
    }

    const center = lookAt.position;
    const minLat = restrict.southWest.latitude + (center.lat - visible.southWest.latitude);
    const maxLat = restrict.northEast.latitude - (visible.northEast.latitude - center.lat);
    const minLng = restrict.southWest.longitude + (center.lng - visible.southWest.longitude);
    const maxLng = restrict.northEast.longitude - (visible.northEast.longitude - center.lng);
    const nextLat = clamp(center.lat, minLat, maxLat);
    const nextLng = clamp(center.lng, minLng, maxLng);
    if (Math.abs(nextLat - center.lat) < 1e-9 && Math.abs(nextLng - center.lng) < 1e-9) {
      return false;
    }
    map.getViewModel().setLookAtData(
      { ...lookAt, position: { ...center, lat: nextLat, lng: nextLng } },
      false,
    );
    return true;
  }

  private scheduleConstraintCheck(): void {
    if (this.constraintFrame != null) cancelAnimationFrame(this.constraintFrame);
    this.constraintFrame = requestAnimationFrame(() => {
      this.constraintFrame = null;
      this.enforceCameraConstraints();
    });
  }

  // ----- tap / long press (mirror onTap / onLongPress) -----------------------

  private onMapClick(event: H.map.MapEvent): void {
    const point = this.toGeoPointFromEvent(event);
    if (!point) return;

    const markerEntity = this.markerController.find(point);
    if (markerEntity?.state.clickable) {
      this.markerController.dispatchClick(markerEntity.state);
      return;
    }

    // Tiled markers are drawn into a raster overlay (no H.map.Marker to receive
    // a tap, so find() above returns null for them); hit-test them here.
    const tiled = this.markerController.findTiled(point, this.getCameraPosition()?.zoom ?? 0);
    if (tiled?.state.clickable) {
      this.markerController.dispatchClick(tiled.state);
      return;
    }

    const circleEntity = this.circleController.find(point);
    if (circleEntity) {
      this.circleController.dispatchClick({ state: circleEntity.state, clicked: point });
      return;
    }

    const polylineHit = this.polylineController.findWithClosestPoint(point);
    if (polylineHit) {
      this.polylineController.dispatchClick({
        state: polylineHit.entity.state,
        clicked: polylineHit.closestPoint,
      });
      return;
    }

    const polygonEntity = this.polygonController.find(point);
    if (polygonEntity) {
      this.polygonController.dispatchClick({ state: polygonEntity.state, clicked: point });
      return;
    }

    this.notifyMapClick(point);
  }

  private onMapLongClick(event: H.map.MapEvent): void {
    const point = this.toGeoPointFromEvent(event);
    if (!point) return;
    this.notifyMapLongClick(point);
  }

  private onMarkerDragStart(event: H.map.MapEvent): void {
    const pointer = event.currentPointer;
    if (!pointer || !(event.target instanceof H.map.Marker)) return;
    const entity = this.markerController.findByMarker(event.target);
    if (!entity?.state.draggable || !entity.marker) return;

    const markerPoint = this.holder.map.geoToScreen(entity.marker.getGeometry());
    this.markerDragOffset = {
      x: pointer.viewportX - markerPoint.x,
      y: pointer.viewportY - markerPoint.y,
    };
    this.markerController.setSelectedMarker(entity);
    this.markerController.setDraggingState(entity.state, true);
    this.holder.behavior.disable();
    this.markerController.dispatchDragStart(entity.state);
  }

  private onMarkerDrag(event: H.map.MapEvent): void {
    const entity = this.markerController.selectedMarker;
    const pointer = event.currentPointer;
    const offset = this.markerDragOffset;
    if (!entity?.marker || !pointer || !offset) return;

    const coord = this.holder.map.screenToGeo(
      pointer.viewportX - offset.x,
      pointer.viewportY - offset.y,
    );
    if (!coord) return;
    const position = createGeoPoint({ latitude: coord.lat, longitude: coord.lng });
    this.markerController.renderer.setMarkerPosition(entity, position);
    this.markerController.applyDragPosition(entity.state, position);
    this.markerController.dispatchDrag(entity.state);
  }

  private onMarkerDragEnd(event: H.map.MapEvent): void {
    const entity = this.markerController.selectedMarker;
    if (!entity) return;

    this.onMarkerDrag(event);
    this.markerController.setDraggingState(entity.state, false);
    this.markerController.dispatchDragEnd(entity.state);
    this.markerController.setSelectedMarker(null);
    this.markerDragOffset = null;
    this.holder.behavior.enable();
  }

  private toGeoPointFromEvent(event: H.map.MapEvent): GeoPoint | null {
    const pointer = event.currentPointer;
    if (!pointer) return null;
    // While the 2D view fakes tilt/bearing with a CSS transform on the map
    // plane, HERE's native screenToGeo (which ignores that transform) returns
    // the wrong coordinate for taps — the error is zero at the plane's centre
    // and grows toward the edges. Reproject through the holder's tilt-aware
    // inverse, using the tap position in the OUTER container's coordinate space
    // (derived from the raw DOM event so it is unaffected by the transform).
    if (this.getVisualTilt() > 0.5 || Math.abs(this.getVisualBearing()) > 0.01) {
      const outer = this.holder.mapView.parentElement;
      const originalEvent = (event as unknown as { originalEvent?: { clientX?: number; clientY?: number } }).originalEvent;
      const clientX = originalEvent?.clientX;
      const clientY = originalEvent?.clientY;
      if (outer && typeof clientX === 'number' && typeof clientY === 'number') {
        const rect = outer.getBoundingClientRect();
        return this.holder.fromScreenOffsetSync({ x: clientX - rect.left, y: clientY - rect.top });
      }
    }
    // Flat & north-up: the plane is 1:1 with the container, so the native
    // projection is correct (and cheaper).
    const coord = this.holder.map.screenToGeo(pointer.viewportX, pointer.viewportY);
    if (!coord) return null;
    return createGeoPoint({ latitude: coord.lat, longitude: coord.lng });
  }

  // ----- MapDesign (mirror setMapDesignType / setMapDesignTypeChangeListener)

  setMapDesignType(value: HereMapDesignType): void {
    this.mapDesignType = value;
    applyHereBaseLayer(this.holder.map, value);
    this.mapDesignTypeChangeListener?.(value);
  }

  setMapDesignTypeChangeListener(
    listener: HereMapDesignTypeChangeHandler,
    onMapInitialized?: OnMapInitializedHandler,
  ): void {
    this.mapDesignTypeChangeListener = listener;
    listener(this.mapDesignType);
    // Mirrors Android's notifyMapInitialized() inside onMapCameraUpdated.
    if (onMapInitialized && !this.initialized) {
      this.initialized = true;
      onMapInitialized();
    }
  }

  // ----- lifecycle -----------------------------------------------------------

  async clearOverlays(): Promise<void> {
    await Promise.all([
      this.markerController.clear(),
      this.polylineController.clear(),
      this.polygonController.clear(),
      this.groundImageController.clear(),
      this.circleController.clear(),
      this.rasterLayerController.clear(),
    ]);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.cameraMoveEndTimer != null) clearTimeout(this.cameraMoveEndTimer);
    if (this.constraintFrame != null) cancelAnimationFrame(this.constraintFrame);
    this.detachListeners();
    void this.clearOverlays().finally(() => {
      this.markerController.destroy();
      this.holder.map.dispose();
    });
  }

  // ----- markers -------------------------------------------------------------

  async compositionMarkers(data: MarkerState[]): Promise<void> {
    await this.markerController.composition(data);
  }
  async updateMarker(state: MarkerState): Promise<void> {
    await this.markerController.update(state);
  }
  hasMarker(state: MarkerState): boolean { return this.markerController.has(state); }

  /**
   * Shows or hides the native HERE canvas markers. The 2D view hides them while
   * its CSS tilt hack is active (which would otherwise flatten the icons against
   * the ground) and renders upright DOM billboards in their place.
   */
  setNativeMarkersVisible(visible: boolean): void {
    this.markerController.setNativeMarkersVisible(visible);
  }

  /**
   * Marker states rendered as individual native markers (not tiled into the
   * raster overlay). Only these need the tilted-view DOM billboard fallback;
   * tiled markers are drawn by the raster tile layer, which HERE tilts natively.
   * Returning the tiled markers here too would re-mount tens of thousands of
   * DOM `<img>` nodes whenever the map is tilted, freezing the main thread.
   */
  getNonTiledMarkerStates(): MarkerState[] {
    return this.markerController.markerManager
      .allEntities()
      .filter(entity => entity.marker !== null)
      .map(entity => entity.state);
  }

  setOnMarkerClickListener(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnClickListener(listener);
  }
  setOnMarkerDragStart(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnDragStart(listener);
  }
  setOnMarkerDrag(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnDrag(listener);
  }
  setOnMarkerDragEnd(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnDragEnd(listener);
  }
  setOnMarkerAnimateStart(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnAnimateStart(listener);
  }
  setOnMarkerAnimateEnd(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnAnimateEnd(listener);
  }
  setMarkerAnimationOverlayHost(host: ((entry: never) => void) | null): void {
    this.markerController.setMarkerAnimationOverlayHost(host as never);
  }

  // ----- circles -------------------------------------------------------------

  async compositionCircles(data: CircleState[]): Promise<void> {
    await this.circleController.composition(data);
  }
  async updateCircle(state: CircleState): Promise<void> {
    await this.circleController.update(state);
  }
  hasCircle(state: CircleState): boolean { return this.circleController.has(state); }
  setOnCircleClickListener(listener: OnCircleEventHandler | null): void {
    this.circleController.clickListener = listener;
  }

  // ----- polylines -----------------------------------------------------------

  async compositionPolylines(data: PolylineState[]): Promise<void> {
    await this.polylineController.composition(data);
  }
  async updatePolyline(state: PolylineState): Promise<void> {
    await this.polylineController.update(state);
  }
  hasPolyline(state: PolylineState): boolean { return this.polylineController.has(state); }
  setOnPolylineClickListener(listener: OnPolylineEventHandler | null): void {
    this.polylineController.clickListener = listener;
  }

  // ----- polygons ------------------------------------------------------------

  async compositionPolygons(data: PolygonState[]): Promise<void> {
    await this.polygonController.composition(data);
  }
  async updatePolygon(state: PolygonState): Promise<void> {
    await this.polygonController.update(state);
  }
  hasPolygon(state: PolygonState): boolean { return this.polygonController.has(state); }
  setOnPolygonClickListener(listener: OnPolygonEventHandler | null): void {
    this.polygonController.clickListener = listener;
  }

  // ----- ground images -------------------------------------------------------

  async compositionGroundImages(data: GroundImageState[]): Promise<void> {
    await this.groundImageController.add(data);
  }
  async updateGroundImage(state: GroundImageState): Promise<void> {
    await this.groundImageController.update(state);
  }
  hasGroundImage(state: GroundImageState): boolean {
    return this.groundImageController.has(state);
  }
  setOnGroundImageClickListener(listener: OnGroundImageEventHandler | null): void {
    this.groundImageController.clickListener = listener;
  }

  // ----- raster layers -------------------------------------------------------

  async compositionRasterLayers(data: RasterLayerState[]): Promise<void> {
    await this.rasterLayerController.add(data);
  }
  async updateRasterLayer(state: RasterLayerState): Promise<void> {
    await this.rasterLayerController.update(state);
  }
  hasRasterLayer(state: RasterLayerState): boolean {
    return this.rasterLayerController.has(state);
  }
}

/**
 * Apply a `HereMapDesignType` to a HERE JS `H.Map` by switching the base layer.
 * Mirrors the Android scene-reload inside `setMapDesignType(value)`.
 */
function applyHereBaseLayer(map: H.Map, design: HereMapDesignType): void {
  const platform = getHerePlatform();
  if (!platform) return;
  map.setBaseLayer(resolveHereBaseLayer(platform, design));
}

/** Sentinel enum-like ids; mirrors `HereMapDesign.NormalDay.id` in Android. */
export const HereDesignId = {
  NormalDay: 'normal.day',
  NormalNight: 'normal.night',
  Satellite: 'satellite.day',
  HybridDay: 'hybrid.day',
  HybridNight: 'hybrid.night',
  TerrainDay: 'terrain.day',
} as const;

/**
 * Per-scheme Raster Tile API v3 parameters (`resource`/`style`/`format`),
 * keyed by `HereDesignId`. Only the `normal` scheme ships a night variant;
 * satellite and terrain fall back to their day imagery since HERE doesn't
 * bundle one.
 *
 * We build these tiles directly via `H.service.rasterTile.Provider` instead
 * of using `platform.createDefaultLayers()`'s bundled `raster.*` layers:
 * `createDefaultLayers()` builds those against HERE's retired Map Tile API v2
 * (`maps.ls.hereapi.com/maptile/2.1/...`), which now answers every tile
 * request with HTTP 410 and leaves the map blank (confirmed against the live
 * API — passing an `engineType` option to `createDefaultLayers()` does not
 * change this). Hitting the Raster Tile API v3 endpoint
 * (`maps.hereapi.com/v3/...`) directly avoids that dead endpoint.
 */
const HERE_RASTER_TILE_CONFIG: Record<
  string,
  { resource: 'base' | 'background'; style: string; format: 'png8' | 'jpeg' }
> = {
  [HereDesignId.NormalDay]: { resource: 'base', style: 'explore.day', format: 'png8' },
  [HereDesignId.NormalNight]: { resource: 'base', style: 'explore.night', format: 'png8' },
  [HereDesignId.Satellite]: { resource: 'background', style: 'satellite.day', format: 'jpeg' },
  [HereDesignId.HybridDay]: { resource: 'base', style: 'explore.satellite.day', format: 'png8' },
  [HereDesignId.HybridNight]: { resource: 'base', style: 'explore.satellite.day', format: 'png8' },
  [HereDesignId.TerrainDay]: { resource: 'base', style: 'topo.day', format: 'png8' },
};

export function resolveHereBaseLayer(
  platform: H.service.Platform,
  design: HereMapDesignType,
): H.map.layer.Layer {
  const config = HERE_RASTER_TILE_CONFIG[design.id] ?? HERE_RASTER_TILE_CONFIG[HereDesignId.NormalDay];
  const rasterTileService = platform.getRasterTileService({
    format: config.format,
    tileSize: 512,
    resource: config.resource,
    queryParams: { style: config.style },
  });
  const provider = new H.service.rasterTile.Provider(rasterTileService, {
    engineType: H.Map.EngineType.P2D,
    tileSize: 512,
  });
  return new H.map.layer.TileLayer(provider);
}

/**
 * Allows the host application to register the `H.service.Platform` instance it
 * constructed with its HERE credentials. Mirrors Android's
 * `HereMapViewControllerStore.initSDK(context)` authentication flow.
 *
 * Deprecated: prefer importing `setHerePlatform` from `HereViewControllerStore`
 * directly. Re-exported here to keep the symbol discoverable alongside the
 * controller.
 */
export { setHerePlatform } from './HereViewControllerStore';

// Re-exports used by the view component.
export type { OnMapEventHandler };

function clamp(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}
