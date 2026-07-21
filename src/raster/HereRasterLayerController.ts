/**
 * Port of `HereRasterLayerController.kt` in
 * `android-for-here/.../raster/HereRasterLayerController.kt`.
 *
 * Android's controller also implements `warmupNetworkIfNeeded(holder)` to
 * pre-warm HERE SDK's network stack. The JS API does not require this; the
 * method is exposed as a no-op to keep the controller API aligned.
 */
import {
  RasterLayerController,
  RasterLayerManager,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import type { HereRasterLayerHandle } from './HereRasterLayerHandle';
import { HereRasterLayerOverlayRenderer } from './HereRasterLayerOverlayRenderer';

export class HereRasterLayerController extends RasterLayerController<HereRasterLayerHandle & object> {
  constructor(renderer: HereRasterLayerOverlayRenderer) {
    super({
      rasterLayerManager: new RasterLayerManager<HereRasterLayerHandle & object>(),
      renderer,
    });
  }

  async composition(data: RasterLayerState[]): Promise<void> {
    await this.add(data);
  }

  has(state: RasterLayerState): boolean {
    return this.rasterLayerManager.hasEntity(state.id);
  }

  /**
   * Mirrors `warmupNetworkIfNeeded(holder: HereViewHolder)` in Android.
   * The JS API has no equivalent warm-up step, so this is intentionally empty.
   */
  warmupNetworkIfNeeded(): void {
    // no-op
  }
}
