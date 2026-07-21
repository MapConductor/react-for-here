/**
 * Port of `HereGroundImageController.kt` in
 * `android-for-here/.../groundimage/HereGroundImageController.kt`.
 *
 *   class HereGroundImageController(
 *       groundImageManager: GroundImageManagerInterface<HereActualGroundImage> = GroundImageManager(),
 *       renderer: HereGroundImageOverlayRenderer,
 *   ) : GroundImageController<HereActualGroundImage>(groundImageManager, renderer)
 */
import {
  GroundImageController,
  GroundImageManager,
  type GroundImageState,
} from '@mapconductor/js-sdk-core';
import type { HereActualGroundImage } from '../HereTypeAlias';
import { HereGroundImageOverlayRenderer } from './HereGroundImageOverlayRenderer';

export class HereGroundImageController extends GroundImageController<HereActualGroundImage> {
  constructor(renderer: HereGroundImageOverlayRenderer) {
    super({
      groundImageManager: new GroundImageManager<HereActualGroundImage>(),
      renderer,
    });
  }

  async composition(data: GroundImageState[]): Promise<void> {
    await this.add(data);
  }

  has(state: GroundImageState): boolean {
    return this.groundImageManager.hasEntity(state.id);
  }
}
