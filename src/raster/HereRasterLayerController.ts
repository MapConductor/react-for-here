/**
 * Port of `HereRasterLayerController.kt` in
 * `android-for-here/.../raster/HereRasterLayerController.kt`.
 *
 * Android's controller also implements `warmupNetworkIfNeeded(holder)` to
 * pre-warm HERE SDK's network stack. The JS API does not require this; the
 * method is exposed as a no-op to keep the controller API aligned.
 */
import { RasterLayerController, RasterLayerManager , type RasterHeaderSupport } from '@mapconductor/js-sdk-core';
import type { HereRasterLayerHandle } from './HereRasterLayerHandle';
import { HereRasterLayerOverlayRenderer } from './HereRasterLayerOverlayRenderer';

export class HereRasterLayerController extends RasterLayerController<HereRasterLayerHandle & object> {
  /**
   * H.map.provider.ImageTileProvider は URL を返す形で、取得そのものは HERE の JS API が行う。
   * android / ios の HERE は対応済みなので、ここは web だけの制約。
   *
   * userAgent はブラウザが上書きを許さないので、どのプロバイダでも web では効かない。
   */
  protected override get headerSupport(): RasterHeaderSupport {
    return { provider: 'HERE', extraHeaders: false };
  }

  constructor(renderer: HereRasterLayerOverlayRenderer) {
    super({
      rasterLayerManager: new RasterLayerManager<HereRasterLayerHandle & object>(),
      renderer,
    });
  }

  /**
   * Mirrors `warmupNetworkIfNeeded(holder: HereViewHolder)` in Android.
   * The JS API has no equivalent warm-up step, so this is intentionally empty.
   */
  warmupNetworkIfNeeded(): void {
    // no-op
  }
}
