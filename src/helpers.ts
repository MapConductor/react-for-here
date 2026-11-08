import { overlayStackBeforeId, overlayStackZ, type OverlayKind, type OverlayStackKey } from '@mapconductor/js-sdk-core';
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

// ── Overlay stacking ───────────────────────────────────────────────────────
//
// Bottom to top, on every provider: raster < ground image < polygon < circle < polyline <
// marker (js-sdk-core OVERLAY_STACK_ORDER).
//
// HERE draws map objects in two places. The map's own object layer (map.addObject) is drawn
// over every layer in map.getLayers(); in it, spatial objects (polygons, circles, polylines)
// are ordered by zIndex, `H.map.Overlay` bitmaps are drawn over the spatials whatever their
// zIndex, and markers over both. Rasters are TileLayers in map.getLayers(), so already under
// the objects. Ground images therefore get an ObjectLayer of their own in map.getLayers(),
// above the rasters, and the spatials get bands of zIndex.

/** zIndex of a spatial object (polygon, circle, polyline): one band of 1024 per kind. */
export function spatialStackZIndex(kind: 'polygon' | 'circle' | 'polyline', zIndex: number | null | undefined): number {
  return overlayStackZ(kind, zIndex, { bandSize: 1024 });
}

const layerStackKeys = new WeakMap<object, OverlayStackKey>();
let layerStackSequence = 0;

/**
 * Adds a layer to map.getLayers() at its place in the stack: rasters (by zIndex), then the
 * ground-image layer, then marker tiles. Layers that are not ours (the base layer) are left
 * where they are.
 */
export function addStackedLayer(map: H.Map, layer: H.map.layer.Layer, kind: OverlayKind, zIndex: number | null | undefined = 0): void {
  const key: OverlayStackKey = { kind, zIndex: zIndex ?? 0, sequence: ++layerStackSequence };
  layerStackKeys.set(layer, key);
  const layers: unknown[] = map.getLayers()?.asArray?.() ?? [];
  const ids = layers.map((_, i) => String(i));
  const beforeId = overlayStackBeforeId(ids, (id) => layerStackKeys.get(layers[Number(id)] as object) ?? null, key);
  if (beforeId == null) map.addLayer(layer);
  else map.addLayer(layer, Number(beforeId));
}
