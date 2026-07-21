/**
 * Port of `HereMarkerController.kt` in
 * `android-for-here/.../marker/HereMarkerController.kt`.
 *
 * First version omits Android-only marker tiling / tile-server integration
 * (`syncTiledOverlay`, `MarkerTileRasterLayerCallback`, …). Ordinary markers
 * follow the same pipeline as Android:
 *
 *   JS MarkerState -> renderer -> H.map.Marker -> H.Map
 */
import {
  AbstractMarkerController,
  MarkerManager,
  Settings,
  createDefaultIcon,
  createGeoPoint,
  type GeoPoint,
  type GeoPointInterface,
  type MarkerEntity,
  type MarkerState,
} from '@mapconductor/js-sdk-core';
import { HereMarkerRenderer } from './HereMarkerRenderer';
import type { HereActualMarker } from '../HereTypeAlias';
import type { HereViewHolder } from '../HereViewHolder';

export class HereMarkerController extends AbstractMarkerController<HereActualMarker> {
  declare readonly renderer: HereMarkerRenderer;

  private selected: MarkerEntity<HereActualMarker> | null = null;

  /**
   * Mirrors `HereMarkerController.create(holder, markerTiling)` companion
   * factory in Android.
   */
  static create(holder: HereViewHolder): HereMarkerController {
    const renderer = new HereMarkerRenderer(holder);
    return new HereMarkerController({
      markerManager: MarkerManager.defaultManager<HereActualMarker>(),
      renderer,
    });
  }

  private constructor({
    markerManager,
    renderer,
  }: {
    markerManager: MarkerManager<HereActualMarker>;
    renderer: HereMarkerRenderer;
  }) {
    super({ markerManager, renderer });
  }

  get selectedMarker(): MarkerEntity<HereActualMarker> | null {
    return this.selected;
  }

  setSelectedMarker(entity: MarkerEntity<HereActualMarker> | null): void {
    this.selected = entity;
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
    const nearest = this.markerManager.findNearest(position as GeoPoint);
    if (!nearest) return null;

    const touchScreen = this.renderer.holder.toScreenOffset(position);
    const markerScreen = this.renderer.holder.toScreenOffset(nearest.state.position);

    const icon = nearest.state.icon;
    const bitmapIcon = icon?.toBitmapIcon() ?? createDefaultIcon().toBitmapIcon();
    const tolerancePx = Settings.Default.tapTolerance;

    // bitmapIcon.size already reflects iconSize * scale (see AbstractDefaultIcon.toBitmapIcon),
    // so use it directly — mirrors Android's `dpToPxForBitmap(icon.iconSize) * icon.scale`.
    const iconWidthPx = bitmapIcon.size.width;
    const iconHeightPx = bitmapIcon.size.height;
    const anchorX = bitmapIcon.anchor.x;
    const anchorY = bitmapIcon.anchor.y;

    const dx = touchScreen.x - markerScreen.x;
    const dy = touchScreen.y - markerScreen.y;
    const left = -anchorX * iconWidthPx - tolerancePx;
    const right = (1.0 - anchorX) * iconWidthPx + tolerancePx;
    const top = -anchorY * iconHeightPx - tolerancePx;
    const bottom = (1.0 - anchorY) * iconHeightPx + tolerancePx;

    return dx >= left && dx <= right && dy >= top && dy <= bottom ? nearest : null;
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
  }
}
