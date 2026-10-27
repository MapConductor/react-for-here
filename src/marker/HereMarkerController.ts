/**
 * Port of `HereMarkerController.kt` in
 * `android-for-here/.../marker/HereMarkerController.kt`.
 *
 * Ordinary markers follow the same pipeline as Android:
 *
 *   JS MarkerState -> renderer -> H.map.Marker -> H.Map
 *
 * Large static marker sets are tiled: rendered off-DOM into a raster overlay
 * (see {@link MarkerTileRenderer}) served through the shared tile service
 * worker, so tens of thousands of markers stay performant. Mirrors the
 * Leaflet/Azure Maps marker controllers.
 */
import {
  AbstractMarkerController,
  LocalTileServer,
  MARKER_HIT_RADIUS_MOUSE_PX,
  MARKER_HIT_RADIUS_TOUCH_PX,
  MarkerManager,
  MarkerTileRenderer,
  MarkerTilingOptions,
  RasterLayerSource,
  createDefaultIcon,
  createGeoPoint,
  createRasterLayerState,
  markerHitShape,
  pickMarkerHit,
  type GeoPoint,
  type GeoPointInterface,
  type MarkerEntity,
  type MarkerState,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import { HereMarkerRenderer } from './HereMarkerRenderer';
import type { HereActualMarker } from '../HereTypeAlias';
import type { HereViewHolder } from '../HereViewHolder';

export class HereMarkerController extends AbstractMarkerController<HereActualMarker> {
  declare readonly renderer: HereMarkerRenderer;

  private selected: MarkerEntity<HereActualMarker> | null = null;

  private tileRenderer: MarkerTileRenderer<MarkerState> | null = null;
  private tileRouteId: string | null = null;
  private tileVersion = 0;
  private tileGeneration = 0;

  /** Wired by HereMapViewController to drive the tiled-marker raster overlay. */
  onRasterLayerUpdate: ((state: RasterLayerState | null) => Promise<void>) | null = null;

  /**
   * Mirrors `HereMarkerController.create(holder, markerTiling)` companion
   * factory in Android.
   */
  static create(
    holder: HereViewHolder,
    tilingOptions: MarkerTilingOptions = MarkerTilingOptions.Default,
  ): HereMarkerController {
    const renderer = new HereMarkerRenderer(holder);
    return new HereMarkerController({
      markerManager: MarkerManager.defaultManager<HereActualMarker>(
        null,
        tilingOptions.minMarkerCount,
      ),
      renderer,
      tilingOptions,
    });
  }

  private constructor({
    markerManager,
    renderer,
    tilingOptions,
  }: {
    markerManager: MarkerManager<HereActualMarker>;
    renderer: HereMarkerRenderer;
    tilingOptions: MarkerTilingOptions;
  }) {
    super({ markerManager, renderer });
    this.tilingOptions = tilingOptions;
  }

  private readonly tilingOptions: MarkerTilingOptions;

  get selectedMarker(): MarkerEntity<HereActualMarker> | null {
    return this.selected;
  }

  setSelectedMarker(entity: MarkerEntity<HereActualMarker> | null): void {
    this.selected = entity;
  }

  /**
   * Shows/hides every native HERE marker. The 2D view hides them while its CSS
   * tilt hack is active (they would otherwise be laid flat against the ground)
   * and draws upright DOM/canvas billboards instead. The live entities live in
   * this controller's MarkerManager, so the toggle is applied here; the renderer
   * only records the state so markers added later inherit it. Hit-testing is
   * unaffected because clicks are resolved via the map tap + `find()` against
   * the marker state, not the native marker's own event.
   */
  setNativeMarkersVisible(visible: boolean): void {
    this.renderer.setNativeVisible(visible);
    for (const entity of this.markerManager.allEntities()) {
      entity.marker?.setVisibility(visible);
    }
  }

  // Widens `AbstractMarkerController.setDraggingState` to public so the map
  // view controller can drive it from the map-level pointer events it uses to
  // synthesize HERE's marker drag lifecycle (see `HereMapViewController`).
  override setDraggingState(state: MarkerState, dragging: boolean): void {
    super.setDraggingState(state, dragging);
  }

  /**
   * The pointer behind the tap `find` is about to resolve: a finger gets
   * `MARKER_HIT_RADIUS_TOUCH_PX` of slop, a mouse none. Set by the map's tap
   * handler from HERE's `currentPointer.type` (see HereGestureHandlers).
   */
  pointerType: 'touch' | 'mouse' = 'mouse';

  /**
   * Mirrors `find(position: GeoPointInterface)` in Android: the marker whose
   * drawn pin (label included, `markerHitShape`) is under the tap, else the
   * nearest within the pointer's slop. Chosen by the core `pickMarkerHit`.
   *
   * Markers overlap on screen — especially while tilted, where the CSS rotateX
   * foreshortens vertical spacing so a lower pin's head covers the pin behind
   * it — so every marker's on-screen pin is tested, not the geographically
   * nearest. Of those under the tap, the one with the largest screen y is drawn
   * last (billboard paint order and native draw order) and wins; only when the
   * tap is on no pin does the slop come in, so it never lets a far pin beat the
   * one clicked. The whole square bitmap used to count, plus
   * `Settings.Default.tapTolerance` (48 px) around it.
   */
  override find(position: GeoPointInterface): MarkerEntity<HereActualMarker> | null {
    const holder = this.renderer.holder;
    const tolerance = this.pointerType === 'touch' ? MARKER_HIT_RADIUS_TOUCH_PX : MARKER_HIT_RADIUS_MOUSE_PX;
    return (
      pickMarkerHit(
        holder.toScreenOffset(position),
        this.markerManager.allEntities(),
        entity => ({
          anchorScreen: holder.toScreenOffset(entity.state.position),
          ...markerHitShape((entity.state.icon ?? createDefaultIcon()).toBitmapIcon()),
        }),
        tolerance,
      )?.item ?? null
    );
  }

  override async update(state: MarkerState): Promise<void> {
    if (this.isDragging(state)) return;
    await super.update(state);
  }

  has(state: MarkerState): boolean {
    return this.selected?.state.id === state.id || this.markerManager.hasEntity(state.id);
  }

  // Mirrors Android's `applyDragPosition` helper: keeps the dragged marker's
  // state in sync with the provider marker position during a drag.
  applyDragPosition(state: MarkerState, position: GeoPoint): void {
    state.setPosition(createGeoPoint({ latitude: position.latitude, longitude: position.longitude }));
  }

  findByMarker(marker: HereActualMarker): MarkerEntity<HereActualMarker> | null {
    const data = marker.getData();
    if (!data || typeof data !== 'object') return null;
    const id = (data as Record<string, unknown>)['mc:id'];
    if (typeof id !== 'string') return null;
    const entity = this.markerManager.getEntity(id);
    return entity?.marker === marker ? entity : null;
  }

  override async clear(): Promise<void> {
    await super.clear();
    this.selected = null;
    await this.removeTileOverlay();
  }

  override destroy(): void {
    void this.removeTileOverlay();
    super.destroy();
  }

  protected override shouldTile(state: MarkerState, totalCount: number): boolean {
    return (
      this.tilingOptions.enabled &&
      totalCount >= this.tilingOptions.minMarkerCount &&
      !state.draggable &&
      state.getAnimation() == null &&
      LocalTileServer.isServiceWorkerSupported()
    );
  }

  protected override async onTiledMarkersChanged(): Promise<void> {
    await this.syncTiledOverlay();
  }

  /** Nearest tiled (raster) marker to a clicked point, or null. */
  findTiled(position: GeoPoint, zoom: number): MarkerEntity<HereActualMarker> | null {
    const found = this.tileRenderer?.findNearest(position, MARKER_HIT_RADIUS_MOUSE_PX, zoom);
    return found ? this.markerManager.getEntity(found.id) : null;
  }

  private async syncTiledOverlay(): Promise<void> {
    const generation = ++this.tileGeneration;
    const tiledStates = this.markerManager
      .allEntities()
      .filter(entity => entity.tiling)
      .map(entity => entity.state);

    if (tiledStates.length === 0) {
      await this.removeTileOverlay();
      return;
    }

    this.tileRouteId ??= `mc-here-tile-${generateId()}`;
    const server = LocalTileServer.startServer();
    const renderer = new MarkerTileRenderer<MarkerState>(tiledStates, 256, this.tilingOptions.iconScaleCallback ?? undefined);
    this.tileRenderer = renderer;
    this.tileVersion++;
    server.register(this.tileRouteId, renderer);

    server.startServiceWorker('/tile-sw.js');
    await server.waitForController();
    await server.sendSWRegisterAndWait(this.tileRouteId, await renderer.toSWData());
    const template = server.urlTemplate({
      routeId: this.tileRouteId,
      tileSize: 256,
      cacheKey: String(this.tileVersion),
    });

    // A newer sync (or clear()/destroy()) ran while we awaited the service
    // worker; applying this stale result would resurrect a removed overlay or
    // clobber a newer one.
    if (generation !== this.tileGeneration) return;

    await this.onRasterLayerUpdate?.(
      createRasterLayerState({
        id: 'mc-marker-tiles',
        source: RasterLayerSource.UrlTemplate({ template, tileSize: 256 }),
      }),
    );
  }

  private async removeTileOverlay(): Promise<void> {
    this.tileGeneration++;
    if (!this.tileRouteId) return;
    LocalTileServer.startServer().unregister(this.tileRouteId);
    this.tileRenderer = null;
    this.tileRouteId = null;
    await this.onRasterLayerUpdate?.(null);
  }
}

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}
