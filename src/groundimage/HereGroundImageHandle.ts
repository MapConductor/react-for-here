/**
 * Port of `HereGroundImageHandle.kt` in
 * `android-for-here/.../groundimage/HereGroundImageHandle.kt`.
 *
 *   data class HereGroundImageHandle(
 *       val routeId: String,
 *       val generation: Long,
 *       val cacheKey: String,
 *       val sourceName: String,
 *       val layerName: String,
 *       val dataSource: RasterDataSource,
 *       val layer: MapLayer,
 *       val tileProvider: GroundImageTileProvider,
 *   )
 *
 * The JS API does not expose `RasterDataSource`/`MapLayer`, so the handle
 * stores the equivalent `H.map.Overlay` ground overlay that the renderer
 * attaches to the map. The fields mirror Android's so the renderer can
 * compare routeId/generation across updates.
 */
export interface HereGroundImageHandle {
  readonly routeId: string;
  readonly generation: number;
  readonly cacheKey: string;
  readonly overlay: H.map.Overlay;
}
