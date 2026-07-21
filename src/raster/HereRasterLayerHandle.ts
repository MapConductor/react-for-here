/**
 * Mirrors `HereRasterLayerHandle` in
 * `android-for-here/.../raster/HereRasterLayerOverlayRenderer.kt`.
 *
 *   data class HereRasterLayerHandle(
 *       val dataSource: RasterDataSource,
 *       val layer: MapLayer,
 *       val sourceName: String,
 *       val layerName: String,
 *       val routeId: String?,
 *   )
 *
 * The JS API exposes `H.map.layer.TileLayer` + `H.map.provider.ImageTileProvider`
 * instead of `RasterDataSource`/`MapLayer`; the handle keeps Android's name
 * and stores the equivalent layer reference.
 */
export interface HereRasterLayerHandle {
  readonly layer: H.map.layer.Layer;
  attached: boolean;
  readonly sourceName: string;
  readonly layerName: string;
  readonly routeId: string | null;
}
