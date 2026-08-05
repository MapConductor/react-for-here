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
import { useState } from 'react';
import {
  MapCameraPosition as MapCameraPositionNS,
  MapViewState,
  createRandomId,
  type GeoPoint,
  type MapCameraPosition,
  type MapViewControllerInterface,
  type GeoRectBounds,
  type MapViewHolder,
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
  readonly id: string;
  private _cameraPosition: MapCameraPosition;
  private _mapDesignType: HereMapDesignType;
  private _controller: MapViewControllerInterface | null = null;
  private _cameraPositionChangeListener: ((camera: MapCameraPosition) => void) | null = null;

  constructor({
    id = createRandomId(),
    mapDesignType = HereMapDesign.NormalDay,
    cameraPosition = MapCameraPositionNS.Default,
  }: HereViewStateParams = {}) {
    super();
    this.id = id;
    this._cameraPosition = cameraPosition;
    this._mapDesignType = mapDesignType;
  }

  override get cameraPosition(): MapCameraPosition {
    return this._cameraPosition;
  }

  override get mapDesignType(): HereMapDesignType {
    return this._mapDesignType;
  }

  override set mapDesignType(value: HereMapDesignType) {
    this._mapDesignType = value;
    // Mirrors Android: `this.controller?.setMapDesignType(value)`.
    const ctrl = this._controller as (MapViewControllerInterface & {
      setMapDesignType?: (v: HereMapDesignType) => void;
    }) | null;
    ctrl?.setMapDesignType?.(value);
  }

  override moveCameraTo(position: GeoPoint, durationMillis?: number): void;
  override moveCameraTo(cameraPosition: MapCameraPosition, durationMillis?: number): void;
  override moveCameraTo(
    positionOrCamera: GeoPoint | MapCameraPosition,
    durationMillis?: number,
  ): void {
    const next =
      'zoom' in positionOrCamera
        ? this.resolveCameraPosition(positionOrCamera as MapCameraPosition)
        : this._cameraPosition.copy({ position: positionOrCamera as GeoPoint });

    const ctrl = this._controller;
    if (!ctrl) {
      this._cameraPosition = next;
      return;
    }

    if (!durationMillis || durationMillis === 0) {
      void ctrl.moveCamera(next);
    } else {
      void ctrl.animateCamera(next, { duration: durationMillis });
    }
    this._cameraPosition = next;
    this._cameraPositionChangeListener?.(next);
  }

  override getMapViewHolder(): MapViewHolder<unknown, unknown> | null {
    return this._controller?.holder ?? null;
  }

  override fitBounds(bounds: GeoRectBounds, padding: number = 0): void {
    void this._controller?.fitBounds(bounds, { padding });
  }

  /** Called by `HereMapView2D` when the controller is ready (mirrors `setController`). */
  setController(ctrl: MapViewControllerInterface | null): void {
    this._controller = ctrl;
    if (ctrl) void ctrl.moveCamera(this._cameraPosition);
  }

  /** Called by `HereMapView2D` on every camera update (mirrors `updateCameraPosition`). */
  updateCameraPosition(camera: MapCameraPosition): void {
    this._cameraPosition = camera;
    this._cameraPositionChangeListener?.(camera);
  }

  setCameraPositionChangeListener(
    listener: ((camera: MapCameraPosition) => void) | null,
  ): void {
    this._cameraPositionChangeListener = listener;
  }

  // Mirrors the Android "if zoom/bearing/tilt are all 0, treat as position-only" behaviour.
  private resolveCameraPosition(target: MapCameraPosition): MapCameraPosition {
    const isUnspecified = target.zoom === 0 && target.bearing === 0 && target.tilt === 0;
    return isUnspecified
      ? this._cameraPosition.copy({ position: target.position })
      : target;
  }
}

export function useHereViewState(params: HereViewStateParams = {}): HereViewState {
  const [state] = useState(() => new HereViewState(params));
  return state;
}
