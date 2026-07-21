/**
 * Port of `HerePolylineController.kt` in
 * `android-for-here/.../polyline/HerePolylineController.kt`.
 *
 *   class HerePolylineController(
 *       polylineManager: PolylineManagerInterface<HereActualPolyline> = PolylineManager(),
 *       renderer: HerePolylineOverlayRenderer,
 *   ) : PolylineController<HereActualPolyline>(polylineManager, renderer)
 */
import { PolylineController, PolylineManager, type PolylineState } from '@mapconductor/js-sdk-core';
import type { HereActualPolyline } from '../HereTypeAlias';
import { HerePolylineOverlayRenderer } from './HerePolylineOverlayRenderer';

export class HerePolylineController extends PolylineController<HereActualPolyline> {
  constructor(renderer: HerePolylineOverlayRenderer) {
    super({
      polylineManager: new PolylineManager<HereActualPolyline>(),
      renderer,
    });
  }

  async composition(data: PolylineState[]): Promise<void> {
    await this.add(data);
  }

  has(state: PolylineState): boolean {
    return this.polylineManager.hasEntity(state.id);
  }
}
