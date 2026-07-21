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
 * NOTE: In the Android file, `HereActualCircle = MapPolygon` because HERE SDK
 * for Mobile does not expose a circle type — circles are rendered as a polygon
 * approximation. In the JS API `H.map.Circle` exists natively, so we use it
 * directly. The wrapper name (`HereActualCircle`) is still kept to match the
 * Android typealias.
 */
import type { HereGroundImageHandle } from './groundimage/HereGroundImageHandle';

export type HereActualMarker = H.map.Marker;
export type HereActualCircle = H.map.Circle;
export type HereActualPolyline = H.map.Polyline;
export type HereActualPolygon = H.map.Polygon;
export type HereActualGroundImage = HereGroundImageHandle;
