/**
 * Port of `HereViewStateImpl.kt` in
 * `android-for-here/.../HereViewStateImpl.kt`.
 *
 *   interface HereViewStateInterface : MapViewStateInterface<HereMapDesignType>
 *   class HereViewState(...) : MapViewState<HereMapDesignType>(),
 *                             HereViewStateInterface
 *
 * Skips the Android-only `HereMapViewSaver` (Bundle/rememberSaveable).
 */
import {
  useState } from 'react';
import {
  MapCameraPosition as MapCameraPositionNS,
  MapViewState,
  createRandomId,
  type MapCameraPosition,
  type MapViewControllerInterface,
  type MapViewStateInterface,
} from '@mapconductor/js-sdk-core';
import { HereMapDesign, type HereMapDesignType } from './HereMapDesign';

export type HereViewStateInterface = MapViewStateInterface<HereMapDesignType>;

export interface HereViewStateParams {
  id?: string;
  mapDesignType?: HereMapDesignType;
  cameraPosition?: MapCameraPosition;
}

export class HereViewState
  extends MapViewState<HereMapDesignType>
  implements HereViewStateInterface
{
  private _mapDesignType: HereMapDesignType;

  constructor({
    id = createRandomId(),
    mapDesignType = HereMapDesign.NormalDay,
    cameraPosition = MapCameraPositionNS.Default,
  }: HereViewStateParams = {}) {
    super({ id, cameraPosition });
    this._mapDesignType = mapDesignType;
  }

  override get mapDesignType(): HereMapDesignType {
    return this._mapDesignType;
  }

  override set mapDesignType(value: HereMapDesignType) {
    this._mapDesignType = value;
    // Mirrors Android: `this.attachedMapController?.setMapDesignType(value)`.
    const ctrl = this.attachedMapController as (MapViewControllerInterface & {
      setMapDesignType?: (v: HereMapDesignType) => void;
    }) | null;
    ctrl?.setMapDesignType?.(value);
  }

  /** Called by `HereMapView2D` when the controller is ready (mirrors `setController`). */

  /** Called by `HereMapView2D` on every camera update (mirrors `updateCameraPosition`). */

  // Mirrors the Android "if zoom/bearing/tilt are all 0, treat as position-only" behaviour.
}

export function useHereViewState(params: HereViewStateParams = {}): HereViewStateInterface {
  const [state] = useState(() => new HereViewState(params));
  return state;
}
