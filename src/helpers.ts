/**
 * Re-exports the line-model namespaces so the HERE renderer modules can import
 * them from a single local path. Densify a path with
 * `WGS84Geodesic.createInterpolatePoints` (geodesic) or
 * `Planar.createInterpolatePoints` (straight lines).
 */
export {
  WGS84Geodesic,
  Planar,
} from '@mapconductor/js-sdk-core';
