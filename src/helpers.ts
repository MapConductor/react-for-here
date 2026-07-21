/**
 * Re-exports shared spherical interpolation helpers so the HERE renderer
 * modules can import them from a single local path (mirrors the
 * `com.mapconductor.core.spherical.createInterpolatePoints` imports in the
 * Android renderer files).
 */
export {
  createInterpolatePoints,
  createLinearInterpolatePoints,
} from '@mapconductor/js-sdk-core';
