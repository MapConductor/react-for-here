/**
 * Port of `HerePolygonController.kt` in
 * `android-for-here/.../polygon/HerePolygonController.kt`.
 *
 *   class HerePolygonController(
 *       polygonManager: PolygonManagerInterface<HereActualPolygon> = PolygonManager(),
 *       renderer: HerePolygonOverlayRenderer,
 *   ) : PolygonController<HereActualPolygon>(polygonManager, renderer)
 */
import { PolygonController, PolygonManager, type PolygonState } from '@mapconductor/js-sdk-core';
import type { HereActualPolygon } from '../HereTypeAlias';
import { HerePolygonOverlayRenderer } from './HerePolygonOverlayRenderer';

export class HerePolygonController extends PolygonController<HereActualPolygon> {
  constructor(renderer: HerePolygonOverlayRenderer) {
    super({
      polygonManager: new PolygonManager<HereActualPolygon>(),
      renderer,
    });
  }

  async composition(data: PolygonState[]): Promise<void> {
    await this.add(data);
  }

  has(state: PolygonState): boolean {
    return this.polygonManager.hasEntity(state.id);
  }
}
