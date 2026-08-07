import { MapUISettingsDiagnostics, type MapUISettings } from '@mapconductor/js-sdk-core';
import type { HereViewHolder } from './HereViewHolder';
import type { HereMapDesignType } from './HereMapDesign';
import { resolveHereBaseLayer } from './HereMapViewController';
import { getHerePlatform } from './HereViewControllerStore';
import type { HereMapDesignTypeChangeHandler } from './HereMapViewControllerInterface';

/**
 * ジェスチャー設定と地図デザインの反映。
 *
 * HERE の `Behavior` はジェスチャーをビットマスクで受けるので、パンと 3 つの
 * ズーム操作を個別に切り替えられる。地図は P2D エンジンで動いており、
 * bearing / tilt は MapConductor が CSS の変形で作っているため、
 * 回転・傾斜のジェスチャーはここには無い。
 */
export interface SettingsDeps {
  readonly holder: HereViewHolder;
  readonly designType: { current: HereMapDesignType };
  readonly designTypeListener: { current: HereMapDesignTypeChangeHandler | null };
}

/**
 * `Behavior` takes a bitmask of the gestures to switch, so pan and the three
 * zoom gestures can be gated individually.
 *
 * The map runs on the P2D engine and MapConductor fakes bearing and tilt with
 * a CSS transform on top of it, so there is no rotate or tilt gesture here.
 */
export function applyGestureSettings(deps: SettingsDeps, settings: MapUISettings): void {
  const Feature = H.mapevents.Behavior.Feature;
  const behavior = deps.holder.behavior;
  const zoom = Feature.WHEEL_ZOOM | Feature.DBL_TAP_ZOOM | Feature.PINCH_ZOOM;

  if (settings.scrollGesture) behavior.enable(Feature.PANNING);
  else behavior.disable(Feature.PANNING);
  if (settings.zoomGesture) behavior.enable(zoom);
  else behavior.disable(zoom);

  MapUISettingsDiagnostics.warnIfRequested(
    settings.rotateGesture, 'rotate', 'HERE',
    'the 2D web view fakes bearing with a CSS transform, so there is no rotate gesture',
  );
  MapUISettingsDiagnostics.warnIfRequested(
    settings.tiltGesture, 'tilt', 'HERE',
    'the 2D web view fakes tilt with a CSS transform, so there is no tilt gesture',
  );
}

export function applyMapDesignType(deps: SettingsDeps, value: HereMapDesignType): void {
  deps.designType.current = value;
  applyHereBaseLayer(deps.holder.map, value);
  deps.designTypeListener.current?.(value);
}

/**
 * Apply a `HereMapDesignType` to a HERE JS `H.Map` by switching the base layer.
 * Mirrors the Android scene-reload inside `setMapDesignType(value)`.
 */
function applyHereBaseLayer(map: H.Map, design: HereMapDesignType): void {
  const platform = getHerePlatform();
  if (!platform) return;
  map.setBaseLayer(resolveHereBaseLayer(platform, design));
}
