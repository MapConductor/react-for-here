/**
 * Port of `HereCircleController.kt` in
 * `android-for-here/.../circle/HereCircleController.kt`.
 *
 *   class HereCircleController(
 *       circleManager: CircleManager<HereActualCircle> = CircleManager(),
 *       renderer: HereCircleOverlayRenderer,
 *   ) : CircleController<HereActualCircle>(circleManager, renderer)
 */
import { CircleController, CircleManager, type CircleState } from '@mapconductor/js-sdk-core';
import type { HereActualCircle } from '../HereTypeAlias';
import { HereCircleOverlayRenderer } from './HereCircleOverlayRenderer';

export class HereCircleController extends CircleController<HereActualCircle> {
  constructor(renderer: HereCircleOverlayRenderer) {
    super({ circleManager: new CircleManager<HereActualCircle>(), renderer });
  }

  async composition(data: CircleState[]): Promise<void> {
    await this.add(data);
  }

  has(state: CircleState): boolean {
    return this.circleManager.hasEntity(state.id);
  }
}
