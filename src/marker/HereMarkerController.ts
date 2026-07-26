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
  MarkerManager,
  MarkerTileRenderer,
  MarkerTilingOptions,
  RasterLayerSource,
  Settings,
  createDefaultIcon,
  createGeoPoint,
  createRasterLayerState,
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
   * Mirrors `find(position: GeoPointInterface)` in Android:
   * nearest marker within its icon's screen footprint (with tap tolerance).
   */
  override find(position: GeoPointInterface): MarkerEntity<HereActualMarker> | null {
    const touchScreen = this.renderer.holder.toScreenOffset(position);
    const tolerancePx = Settings.Default.tapTolerance;

    // Markers overlap on screen — especially while tilted, where the CSS
    // rotateX foreshortens vertical spacing so a lower pin's head covers the
    // pin behind it. Testing only the geographically nearest marker would hit
    // whichever anchor is closest in lat/lng, not the pin the user actually
    // clicked. Instead, test every marker's on-screen icon rectangle and return
    // the top-most one under the cursor: the pin with the largest screen y is
    // drawn last (matching the billboard paint order and native draw order), so
    // it is the one visually on top.
    // First choose among markers whose icon actually covers the tap (no
    // tolerance): the top-most of those (largest screen y = drawn last = painted
    // on top) is the pin the user sees under the cursor. Only if the tap lands
    // on no icon do we fall back to the nearest within the tap tolerance — so
    // the tolerance can never make a far pin "win" over the pin actually clicked.
    let bestOnIcon: MarkerEntity<HereActualMarker> | null = null;
    let bestOnIconScreenY = -Infinity;
    let bestNear: MarkerEntity<HereActualMarker> | null = null;
    let bestNearDistSq = Infinity;
    for (const entity of this.markerManager.allEntities()) {
      const markerScreen = this.renderer.holder.toScreenOffset(entity.state.position);
      // bitmapIcon.size already reflects iconSize * scale (see AbstractDefaultIcon.toBitmapIcon).
      const bitmapIcon = entity.state.icon?.toBitmapIcon() ?? createDefaultIcon().toBitmapIcon();
      const dx = touchScreen.x - markerScreen.x;
      const dy = touchScreen.y - markerScreen.y;
      const left = -bitmapIcon.anchor.x * bitmapIcon.size.width;
      const right = (1.0 - bitmapIcon.anchor.x) * bitmapIcon.size.width;
      const top = -bitmapIcon.anchor.y * bitmapIcon.size.height;
      const bottom = (1.0 - bitmapIcon.anchor.y) * bitmapIcon.size.height;
      if (dx >= left && dx <= right && dy >= top && dy <= bottom) {
        if (markerScreen.y > bestOnIconScreenY) {
          bestOnIconScreenY = markerScreen.y;
          bestOnIcon = entity;
        }
      } else if (
        dx >= left - tolerancePx && dx <= right + tolerancePx &&
        dy >= top - tolerancePx && dy <= bottom + tolerancePx
      ) {
        const distSq = dx * dx + dy * dy;
        if (distSq < bestNearDistSq) {
          bestNearDistSq = distSq;
          bestNear = entity;
        }
      }
    }
    return bestOnIcon ?? bestNear;
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
      .filter(entity => entity.marker === null)
      .map(entity => entity.state);

    if (tiledStates.length === 0) {
      await this.removeTileOverlay();
      return;
    }

    this.tileRouteId ??= `mc-here-tile-${generateId()}`;
    const server = LocalTileServer.startServer();
    const renderer = new MarkerTileRenderer<MarkerState>(tiledStates, {
      tileSize: 256,
      iconScaleCallback: this.tilingOptions.iconScaleCallback ?? undefined,
    });
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
