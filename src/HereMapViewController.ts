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
  MapUISettings,
  computeFitBoundsCameraPosition,
  type CircleState,
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
  type CameraRestriction,
  isEmptyCameraRestriction,
} from '@mapconductor/js-sdk-core';
import type { HereMapDesignType } from './HereMapDesign';
import type {
  HereMapDesignTypeChangeHandler,
  HereMapViewControllerInterface,
} from './HereMapViewControllerInterface';
import { HereViewHolder } from './HereViewHolder';
import { HereMarkerController } from './marker/HereMarkerController';
import { HerePolylineController } from './polyline/HerePolylineController';
import { HerePolygonController } from './polygon/HerePolygonController';
import { HereCircleController } from './circle/HereCircleController';
import { HereGroundImageController } from './groundimage/HereGroundImageController';
import { HereRasterLayerController } from './raster/HereRasterLayerController';
import { HereCameraConstraints } from './HereCameraConstraints';
import { readVisibleRegion } from './HereVisibleRegion';
import { HereCameraState } from './HereCameraState';
import {
  applyGestureSettings,
  applyMapDesignType,
  type SettingsDeps,
} from './HereMapSettings';
import {
  handleMapClick,
  handleMapLongClick,
  handleMarkerDrag,
  handleMarkerDragEnd,
  handleMarkerDragStart,
  type GestureDeps,
} from './HereGestureHandlers';


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

  private initialized = false;
  private destroyed = false;

  /** 範囲・ズーム制限のクランプ。状態を持つのでコンストラクタで組み立てて注入する。 */
  private readonly constraints: HereCameraConstraints;

  /** 論理カメラの保持とカメラ変化の解釈。同じくコンストラクタで組み立てる。 */
  private readonly camera: HereCameraState;

  private readonly mapDesignType: { current: HereMapDesignType };
  private readonly mapDesignTypeChangeListener: { current: HereMapDesignTypeChangeHandler | null } = { current: null };
  /** ドラッグ中だけ使う、掴んだ点とマーカー中心のずれ。 */
  private readonly markerDragOffset: { current: { x: number; y: number } | null } = { current: null };

  /** ジェスチャー処理へ渡す依存一式。private を覗かせずに必要なものだけ束ねる。 */
  private get gestureDeps(): GestureDeps {
    return {
      holder: this.holder,
      markerController: this.markerController,
      circleController: this.circleController,
      polylineController: this.polylineController,
      polygonController: this.polygonController,
      uiSettings: this.uiSettings,
      dragOffset: this.markerDragOffset,
      getCameraPosition: () => this.getCameraPosition(),
      getVisualTilt: () => this.getVisualTilt(),
      getVisualBearing: () => this.getVisualBearing(),
      applyUISettings: (settings) => this.applyUISettings(settings),
      onMapClick: (point) => this.notifyMapClick(point),
      onMapLongClick: (point) => this.notifyMapLongClick(point),
    };
  }

  private readonly onMapChangeHandler = () => this.camera.onChange();
  private readonly onMapChangeEndHandler = () => this.camera.onChangeEnd();
  private readonly onMapClickHandler = (event: H.map.MapEvent) => handleMapClick(this.gestureDeps, event);
  private readonly onMapLongClickHandler = (event: H.map.MapEvent) =>
    handleMapLongClick(this.gestureDeps, event);
  private readonly onMarkerDragStartHandler = (event: H.map.MapEvent) =>
    handleMarkerDragStart(this.gestureDeps, event);
  private readonly onMarkerDragHandler = (event: H.map.MapEvent) => handleMarkerDrag(this.gestureDeps, event);
  private readonly onMarkerDragEndHandler = (event: H.map.MapEvent) => handleMarkerDragEnd(this.gestureDeps, event);

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
    this.constraints = new HereCameraConstraints(
      { map: this.holder.map, getVisibleRegion: () => readVisibleRegion(this.holder) },
      { bounds: restrictBounds, minZoom, maxZoom },
    );
    this.camera = new HereCameraState({
      holder: this.holder,
      constraints: this.constraints,
      onCameraMoveStart: (c) => this.notifyCameraMoveStart(c),
      onCameraMove: (c) => this.notifyCameraMove(c),
      onCameraMoveEnd: (c) => this.notifyCameraMoveEnd(c),
      onCameraSettled: (c) => this.notifyControllersCameraChanged(c),
    });
    this.mapDesignType = { current: initialMapDesignType };
    // Tiled markers render into a raster overlay driven by the raster controller.
    this.markerController.onRasterLayerUpdate = async state => {
      if (state) await this.rasterLayerController.composition([state]);
      else await this.rasterLayerController.clear();
    };
    this.camera.seed(holder.map.getViewModel().getLookAtData());
    holder.setController(this);
    this.setupListeners();
    this.constraints.enforce();
    const camera = this.getCameraPosition();
    if (camera) void this.notifyControllersCameraChanged(camera);
  }

  private uiSettings: MapUISettings = { ...MapUISettings.Default };

  /** 設定反映へ渡す依存一式。private を覗かせずに必要なものだけ束ねる。 */
  private get settingsDeps(): SettingsDeps {
    return {
      holder: this.holder,
      designType: this.mapDesignType,
      designTypeListener: this.mapDesignTypeChangeListener,
    };
  }

  applyUISettings(settings: MapUISettings): void {
    this.uiSettings = { ...settings };
    applyGestureSettings(this.settingsDeps, settings);
  }

  setMapDesignType(value: HereMapDesignType): void {
    applyMapDesignType(this.settingsDeps, value);
  }

  setMapDesignTypeChangeListener(
    listener: HereMapDesignTypeChangeHandler,
    onMapInitialized?: OnMapInitializedHandler,
  ): void {
    this.mapDesignTypeChangeListener.current = listener;
    listener(this.mapDesignType.current);
    // Mirrors Android's notifyMapInitialized() inside onMapCameraUpdated.
    if (onMapInitialized && !this.initialized) {
      this.initialized = true;
      onMapInitialized();
    }
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

  getCameraPosition(): MapCameraPosition | null { return this.camera.read(); }

  getVisualTilt(): number { return this.camera.visualTilt; }

  getVisualBearing(): number { return this.camera.visualBearing; }

  moveCamera(position: MapCameraPosition): Promise<boolean> {
    return this.camera.apply(position, { animated: false });
  }

  animateCamera(position: MapCameraPosition, _durationMillis: number): Promise<boolean> {
    return this.camera.apply(position, { animated: true });
  }

  // Unified fit: the core computes center + zoom; moveCamera keeps the current
  // heading/tilt (HERE's setLookAtData({ bounds }) would reset to top-down).
  fitBounds(bounds: GeoRectBounds, padding: number): Promise<boolean> {
    if (!bounds.southWest || !bounds.northEast) return Promise.resolve(false);
    const current = this.getCameraPosition();
    if (!current) return Promise.resolve(false);
    const viewport = this.holder.mapView.parentElement;
    const width = viewport?.clientWidth ?? this.holder.map.getViewPort().width;
    const height = viewport?.clientHeight ?? this.holder.map.getViewPort().height;
    const fit = computeFitBoundsCameraPosition({
      bounds,
      viewportWidthPx: width,
      viewportHeightPx: height,
      padding,
      bearing: current.bearing,
    });
    if (!fit) return Promise.resolve(false);
    const target = current.copy({ position: fit.center, zoom: fit.zoom });
    // snapZoom:false — keep the fractional fit zoom so the bounds fit precisely
    // and `padding` has a visible effect.
    return this.camera.apply(target, { animated: false, snapZoom: false });
  }





  // ----- camera change listeners (mirror onMapCameraUpdated) -----------------



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




  // ----- tap / long press (mirror onTap / onLongPress) -----------------------







  // ----- MapDesign (mirror setMapDesignType / setMapDesignTypeChangeListener)



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

  /**
   * HERE JS API にはカメラ範囲制限の API が無いため、`constrainLookAt` /
   * `enforceCameraConstraints` によるクランプで実現している（android-sdk の HERE と同じ方針）。
   *
   * ここでは core の `CameraRestriction` をその既存クランプの入力に流し込む。既存実装は
   * カメラ中心だけでなく可視領域全体を矩形内に収める点で android-sdk のクランプより厳格なので、
   * `BaseMapViewController.cameraRestrictionCorrection` には置き換えず温存する。
   */
  override setCameraRestriction(restriction: CameraRestriction | null): void {
    super.setCameraRestriction(restriction);
    const effective = isEmptyCameraRestriction(restriction) ? null : restriction;
    this.constraints.set(
      effective
        ? {
            bounds: effective.bounds ?? undefined,
            minZoom: effective.minZoom ?? undefined,
            maxZoom: effective.maxZoom ?? undefined,
          }
        : null,
    );
    this.constraints.enforce();
  }

  destroy(): void {
    super.destroy();
    if (this.destroyed) return;
    this.destroyed = true;
    this.camera.dispose();
    this.constraints.dispose();
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


