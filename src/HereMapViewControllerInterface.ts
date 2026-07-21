/**
 * Port of `HereMapViewControllerInterface.kt` in
 * `android-for-here/.../HereMapViewControllerInterface.kt`.
 *
 *   typealias HereMapDesignTypeChangeHandler = (HereMapDesignType) -> Unit
 *
 *   interface HereMapViewControllerInterface :
 *       MapViewControllerInterface,
 *       MarkerCapableInterface,
 *       PolygonCapableInterface,
 *       PolylineCapableInterface,
 *       CircleCapableInterface,
 *       GroundImageCapableInterface,
 *       RasterLayerCapableInterface {
 *     fun setMapDesignType(value: HereMapDesignType)
 *     fun setMapDesignTypeChangeListener(listener: HereMapDesignTypeChangeHandler)
 *   }
 *
 * The TS controller class (`HereMapViewController`) implements both this
 * interface and `MapViewControllerInterface`, mirroring Android's
 * `HereMapViewController : BaseMapViewController(), HereMapViewControllerInterface, ...`.
 */
import type {
  CircleCapable,
  GroundImageCapable,
  MarkerCapable,
  OnMapInitializedHandler,
  PolygonCapable,
  PolylineCapable,
  RasterLayerCapable,
} from '@mapconductor/js-sdk-core';
import type { HereMapDesignType } from './HereMapDesign';

export type HereMapDesignTypeChangeHandler = (value: HereMapDesignType) => void;

export interface HereMapViewControllerInterface
  extends MarkerCapable,
    PolygonCapable,
    PolylineCapable,
    CircleCapable,
    GroundImageCapable,
    RasterLayerCapable {
  setMapDesignType(value: HereMapDesignType): void;
  setMapDesignTypeChangeListener(
    listener: HereMapDesignTypeChangeHandler,
    onMapInitialized?: OnMapInitializedHandler,
  ): void;
}
