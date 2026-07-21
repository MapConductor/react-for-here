/**
 * Port of `HereViewInitOptions.kt` in
 * `android-for-here/.../HereViewInitOptions.kt`.
 *
 *   data class HereViewInitOptions(
 *       val scheme: MapScheme = MapScheme.NORMAL_DAY,
 *   )
 *
 * On Android this is fed to `HereMapView`; in the JS API the equivalent is
 * the initial base layer / style of the `H.Map`.
 */
import type { HereMapDesignType } from './HereMapDesign';
import { HereMapDesign } from './HereMapDesign';

export interface HereViewInitOptions {
  readonly scheme: string;
}

export function defaultHereViewInitOptions(
  design: HereMapDesignType = HereMapDesign.NormalDay,
): HereViewInitOptions {
  return { scheme: design.getValue() };
}
