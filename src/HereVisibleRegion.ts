import { createGeoRectBounds } from '@mapconductor/js-sdk-core';
import type { VisibleRegion } from '@mapconductor/js-sdk-core';
import type { HereViewHolder } from './HereViewHolder';

/**
 * Mirrors `getMapCameraPosition(cameraState)` in Android: projects the four
 * screen corners back to geo coordinates instead of using
 * `map.getBounds()`'s axis-aligned box, so the visible region stays correct
 * when the map is rotated.
 */
export function readVisibleRegion(holder: HereViewHolder): VisibleRegion | null {
  const viewport = holder.mapView.parentElement;
  const width = viewport?.clientWidth ?? holder.map.getViewPort().width;
  const height = viewport?.clientHeight ?? holder.map.getViewPort().height;
  if (!width || !height) return null;

  const nearLeft = holder.fromScreenOffsetSync({ x: 0, y: height });
  const nearRight = holder.fromScreenOffsetSync({ x: width, y: height });
  const farLeft = holder.fromScreenOffsetSync({ x: 0, y: 0 });
  const farRight = holder.fromScreenOffsetSync({ x: width, y: 0 });
  if (!nearLeft || !nearRight || !farLeft || !farRight) return null;

  const bounds = createGeoRectBounds();
  bounds.extend(nearLeft);
  bounds.extend(nearRight);
  bounds.extend(farLeft);
  bounds.extend(farRight);

  return { bounds, nearLeft, nearRight, farLeft, farRight };
}
