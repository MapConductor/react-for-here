/**
 * Mirrors `HereTypeAlias.kt` in `android-for-here/.../HereTypeAlias.kt`.
 *
 * Each typealias maps the HERE SDK type used by the Android implementation to
 * the equivalent HERE Maps API for JavaScript type:
 *
 *   Android                                -> JavaScript (H.*)
 *   com.here.sdk.mapview.MapMarker         -> H.map.Marker
 *   com.here.sdk.mapview.MapPolygon        -> H.map.Polygon
 *   com.here.sdk.mapview.MapPolyline       -> H.map.Polyline
 *   com.here.sdk.mapview.MapView           -> H.Map
 *
 * NOTE: Like Android (`HereActualCircle = MapPolygon`), circles are rendered
 * as a polygon approximation built from the shared core geometry
 * (`circleToRing`) instead of the native `H.map.Circle`, so the circle shape
 * definition (geodesic vs planar) is unified across providers.
 */
import type { HereGroundImageHandle } from './groundimage/HereGroundImageHandle';

export type HereActualMarker = H.map.Marker;
export type HereActualCircle = H.map.Polygon;
export type HereActualPolyline = H.map.Polyline;
export type HereActualPolygon = H.map.Polygon;
export type HereActualGroundImage = HereGroundImageHandle;
