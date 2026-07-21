/**
 * Port of `HereViewControllerStore.kt` in
 * `android-for-here/.../HereViewControllerStore.kt`.
 *
 *   object HereMapViewControllerStore : StaticHolder<HereMapViewController>() {
 *       fun initSDK(context: Context) { ... SDKNativeEngine.makeSharedInstance(...) }
 *   }
 *
 * On Android this object authenticates the HERE SDK with credentials stored
 * in the AndroidManifest's meta-data. On web the host page is expected to
 * construct `H.service.Platform` directly with its HERE API key and register
 * it via `setHerePlatform(...)` before mounting `<HereMapView2D />`.
 */
import type { HereMapViewController } from './HereMapViewController';

const _store = new Map<string, HereMapViewController>();
let _globalPlatform: H.service.Platform | null = null;
let _initialized = false;

export const HereMapViewControllerStore = {
  initSDK(platform: H.service.Platform): void {
    if (_initialized) return;
    _globalPlatform = platform;
    _initialized = true;
  },

  get(id: string): HereMapViewController | null {
    return _store.get(id) ?? null;
  },

  put(id: string, controller: HereMapViewController): void {
    _store.set(id, controller);
  },

  remove(id: string): void {
    _store.delete(id);
  },

  destroy(id: string): void {
    const ctrl = _store.get(id);
    if (ctrl) {
      ctrl.destroy();
      _store.delete(id);
    }
  },

  getPlatform(): H.service.Platform | null {
    return _globalPlatform;
  },

  isInitialized(): boolean {
    return _initialized;
  },
};

/** Convenience entry used by the provider; mirrors `initSDK(context)`. */
export function setHerePlatform(platform: H.service.Platform | null): void {
  if (platform == null) {
    _globalPlatform = null;
    _initialized = false;
    return;
  }
  HereMapViewControllerStore.initSDK(platform);
}

export function getHerePlatform(): H.service.Platform | null {
  return HereMapViewControllerStore.getPlatform();
}
