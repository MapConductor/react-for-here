/// <reference path="./here.d.ts" />
import { MapDesignTypeInterface, AttributionRule, MarkerCapable, PolygonCapable, PolylineCapable, CircleCapable, GroundImageCapable, RasterLayerCapable, OnMapInitializedHandler, AbstractMarkerOverlayRenderer, MarkerManager, AddParams, ChangeParams, MarkerEntity, GeoPoint, AbstractMarkerController, RasterLayerState, MarkerTilingOptions, MarkerState, GeoPointInterface, AbstractPolylineOverlayRenderer, PolylineState, PolylineEntity, PolylineController, AbstractPolygonOverlayRenderer, PolygonState, PolygonEntity, PolygonController, AbstractCircleOverlayRenderer, CircleState, CircleEntity, CircleController, AbstractGroundImageOverlayRenderer, GroundImageState, GroundImageEntity, GroundImageController, RasterLayerOverlayRenderer, RasterLayerAddParams, RasterLayerChangeParams, RasterLayerEntity, MapCameraPosition, RasterLayerController, RasterHeaderSupport, BaseMapViewController, MapViewControllerInterface, GeoRectBounds, MapUISettings, CameraRestriction, OnMarkerEventHandler, MapViewHolderBase, Offset, MapViewStateInterface, MapViewState, MapConfig, MapProvider, MapViewBaseProps, WebMercatorZoomAltitudeConverter, MapCameraPositionInterface, BitmapIcon } from '@mapconductor/js-sdk-core';
import * as react from 'react';
import { CSSProperties, ReactNode } from 'react';

/**
 * Mirrors `HereMapDesignType` in `android-for-here/.../HereMapDesign.kt`:
 * `typealias HereMapDesignType = MapDesignTypeInterface<MapScheme>`.
 *
 * `MapScheme` here is the HERE Maps API for JavaScript style string
 * (e.g. `H.map.style.NormalDay`). Android uses the equivalent
 * `com.here.sdk.mapview.MapScheme` enum value.
 */
type HereMapDesignType = MapDesignTypeInterface<string>;
/**
 * Mirrors `HereMapDesign` (sealed class) in Android. Each Android `object`
 * (`NormalDay`, `NormalNight`, `Satellite`, ...) maps to a `static` here.
 * The JavaScript style strings come from `H.map.style.*`.
 */
declare class HereMapDesign implements HereMapDesignType {
    readonly id: string;
    readonly attributionRules: readonly AttributionRule[];
    constructor(id: string, attributionRules?: readonly AttributionRule[]);
    getValue(): string;
    /** `MapScheme.NORMAL_DAY` */
    static readonly NormalDay: HereMapDesign;
    /** `MapScheme.NORMAL_NIGHT` */
    static readonly NormalNight: HereMapDesign;
    /** `MapScheme.SATELLITE` */
    static readonly Satellite: HereMapDesign;
    /** `MapScheme.HYBRID_DAY` */
    static readonly HybridDay: HereMapDesign;
    /** `MapScheme.HYBRID_NIGHT` */
    static readonly HybridNight: HereMapDesign;
    /** `MapScheme.LITE_DAY` */
    static readonly LiteDay: HereMapDesign;
    /** `MapScheme.LITE_NIGHT` */
    static readonly LiteNight: HereMapDesign;
    /** `MapScheme.LITE_HYBRID_DAY` */
    static readonly LiteHybridDay: HereMapDesign;
    /** `MapScheme.LITE_HYBRID_NIGHT` */
    static readonly LiteHybridNight: HereMapDesign;
    /** `MapScheme.LOGISTICS_DAY` */
    static readonly LogisticsDay: HereMapDesign;
    /** `MapScheme.LOGISTICS_NIGHT` */
    static readonly LogisticsNight: HereMapDesign;
    /** `MapScheme.LOGISTICS_HYBRID_DAY` */
    static readonly LogisticsHybridDay: HereMapDesign;
    /** `MapScheme.ROAD_NETWORK_DAY` */
    static readonly RoadNetworkDay: HereMapDesign;
    /** `MapScheme.ROAD_NETWORK_NIGHT` */
    static readonly RoadNetworkNight: HereMapDesign;
    /** `HereMapDesign.Custom(id, attributionRules)` */
    static Custom(id: string, attributionRules?: readonly AttributionRule[]): HereMapDesign;
    /**
     * Mirrors `HereMapDesign.create(id: Int): HereMapDesign` in Android, but
     * dispatches by the string id rather than the integer enum value.
     */
    static create(id: string): HereMapDesign;
}

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

type HereMapDesignTypeChangeHandler = (value: HereMapDesignType) => void;
interface HereMapViewControllerInterface extends MarkerCapable, PolygonCapable, PolylineCapable, CircleCapable, GroundImageCapable, RasterLayerCapable {
    setMapDesignType(value: HereMapDesignType): void;
    setMapDesignTypeChangeListener(listener: HereMapDesignTypeChangeHandler, onMapInitialized?: OnMapInitializedHandler): void;
}

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
interface HereGroundImageHandle {
    readonly routeId: string;
    readonly generation: number;
    readonly cacheKey: string;
    readonly overlay: H.map.Overlay;
}

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

type HereActualMarker = H.map.Marker;
type HereActualCircle = H.map.Polygon;
type HereActualPolyline = H.map.Polyline;
type HereActualPolygon = H.map.Polygon;
type HereActualGroundImage = HereGroundImageHandle;

/**
 * Port of `HereMarkerRenderer.kt` in
 * `android-for-here/.../marker/HereMarkerRenderer.kt`.
 *
 * The Android renderer uses `holder.mapView.mapScene.addMapMarkers(...)` and
 * `MapMarker` with `ImageFormat.PNG`/`Anchor2D`; here we use
 * `holder.map.addObject(new H.map.Marker(...))` with `H.Icon`/`H.math.Point`
 * anchor (see `BitmapIcon.ts` for the matching `toMapImage`/`toAnchor2D`).
 */

declare class HereMarkerRenderer extends AbstractMarkerOverlayRenderer<HereViewHolder, HereActualMarker> {
    readonly markerManager: MarkerManager<HereActualMarker>;
    /**
     * Whether the native HERE canvas markers should be visible. The 2D view
     * fakes camera tilt with a CSS `rotateX` on the map container, which lays
     * the canvas-drawn marker icons flat against the ground. While tilted the
     * view hides these native markers (via `setNativeVisible(false)`) and draws
     * upright, billboarded DOM icons instead. New markers created while hidden
     * must inherit this state, so onAdd applies it too.
     */
    private nativeVisible;
    constructor(holder: HereViewHolder);
    /** Whether native markers should currently be visible (see `nativeVisible`). */
    get isNativeVisible(): boolean;
    /**
     * Remembers whether native markers should be visible so that markers added
     * afterwards (see onAdd) inherit the state. NOTE: this renderer does not own
     * the live marker entities — they live in the controller's MarkerManager — so
     * toggling the visibility of existing markers is done by the controller
     * (HereMarkerController.setNativeMarkersVisible), not here.
     */
    setNativeVisible(visible: boolean): void;
    /**
     * Mirrors `onAdd(data: List<AddParamsInterface>): List<HereActualMarker?>`.
     * Each marker is constructed from its BitmapIcon and registered on the map.
     */
    onAdd(data: AddParams[]): Promise<(HereActualMarker | null)[]>;
    /**
     * Mirrors `onChange(data): List<HereActualMarker?>`. Updates icon/position/
     * drawOrder on the existing marker (HERE JS lets us reuse the instance,
     * same as Android).
     */
    onChange(data: ChangeParams<HereActualMarker>[]): Promise<(HereActualMarker | null)[]>;
    /** Mirrors `onRemove(data: List<MarkerEntity<HereActualMarker>>)`. */
    onRemove(data: MarkerEntity<HereActualMarker>[]): Promise<void>;
    /** Mirrors `onPostProcess()` — HERE JS has no batch post-processing step. */
    onPostProcess(): Promise<void>;
    /** Mirrors `setMarkerPosition(entity, position)`. */
    setMarkerPosition(entity: MarkerEntity<HereActualMarker>, position: GeoPoint): void;
    /**
     * Mirrors `setMarkerVisible(entity, visible)`. Android re-adds/removes the
     * marker because `MapMarker` has no visibility property; HERE JS does, so
     * toggle it directly.
     */
    setMarkerVisible(entity: MarkerEntity<HereActualMarker>, visible: boolean): void;
}

/**
 * Port of `HereMarkerController.kt` in
 * `android-for-here/.../marker/HereMarkerController.kt`.
 *
 * Ordinary markers follow the same pipeline as Android:
 *
 *   JS MarkerState -> renderer -> H.map.Marker -> H.Map
 *
 * Large static marker sets are tiled: rendered off-DOM into a raster overlay
 * (see {@link MarkerTileRenderer}) served through the shared tile service
 * worker, so tens of thousands of markers stay performant. Mirrors the
 * Leaflet/Azure Maps marker controllers.
 */

declare class HereMarkerController extends AbstractMarkerController<HereActualMarker> {
    readonly renderer: HereMarkerRenderer;
    private selected;
    private tileRenderer;
    private tileRouteId;
    private tileVersion;
    private tileGeneration;
    /** Wired by HereMapViewController to drive the tiled-marker raster overlay. */
    onRasterLayerUpdate: ((state: RasterLayerState | null) => Promise<void>) | null;
    /**
     * Mirrors `HereMarkerController.create(holder, markerTiling)` companion
     * factory in Android.
     */
    static create(holder: HereViewHolder, tilingOptions?: MarkerTilingOptions): HereMarkerController;
    private constructor();
    private readonly tilingOptions;
    get selectedMarker(): MarkerEntity<HereActualMarker> | null;
    setSelectedMarker(entity: MarkerEntity<HereActualMarker> | null): void;
    /**
     * Shows/hides every native HERE marker. The 2D view hides them while its CSS
     * tilt hack is active (they would otherwise be laid flat against the ground)
     * and draws upright DOM/canvas billboards instead. The live entities live in
     * this controller's MarkerManager, so the toggle is applied here; the renderer
     * only records the state so markers added later inherit it. Hit-testing is
     * unaffected because clicks are resolved via the map tap + `find()` against
     * the marker state, not the native marker's own event.
     */
    setNativeMarkersVisible(visible: boolean): void;
    setDraggingState(state: MarkerState, dragging: boolean): void;
    /**
     * Mirrors `find(position: GeoPointInterface)` in Android:
     * nearest marker within its icon's screen footprint (with tap tolerance).
     */
    find(position: GeoPointInterface): MarkerEntity<HereActualMarker> | null;
    update(state: MarkerState): Promise<void>;
    has(state: MarkerState): boolean;
    applyDragPosition(state: MarkerState, position: GeoPoint): void;
    findByMarker(marker: HereActualMarker): MarkerEntity<HereActualMarker> | null;
    clear(): Promise<void>;
    destroy(): void;
    protected shouldTile(state: MarkerState, totalCount: number): boolean;
    protected onTiledMarkersChanged(): Promise<void>;
    /** Nearest tiled (raster) marker to a clicked point, or null. */
    findTiled(position: GeoPoint, zoom: number): MarkerEntity<HereActualMarker> | null;
    private syncTiledOverlay;
    private removeTileOverlay;
}

/**
 * Port of `HerePolylineOverlayRenderer.kt` in
 * `android-for-here/.../polyline/HerePolylineOverlayRenderer.kt`.
 *
 * Uses the HERE Maps API for JavaScript `H.map.Polyline` instead of
 * `MapPolyline`. The `LineCap.SQUARE` default and the `(zIndex + 512)`
 * drawOrder coercion in Android are preserved as the closest equivalents
 * supported by the JS StyleOptions.
 */

declare class HerePolylineOverlayRenderer extends AbstractPolylineOverlayRenderer<HereViewHolder, HereActualPolyline> {
    createPolyline(state: PolylineState): Promise<HereActualPolyline | null>;
    updatePolylineProperties({ polyline, current, prev, }: {
        polyline: HereActualPolyline;
        current: PolylineEntity<HereActualPolyline>;
        prev: PolylineEntity<HereActualPolyline>;
    }): Promise<HereActualPolyline | null>;
    removePolyline(entity: PolylineEntity<HereActualPolyline>): Promise<void>;
}

/**
 * Port of `HerePolylineController.kt` in
 * `android-for-here/.../polyline/HerePolylineController.kt`.
 *
 *   class HerePolylineController(
 *       polylineManager: PolylineManagerInterface<HereActualPolyline> = PolylineManager(),
 *       renderer: HerePolylineOverlayRenderer,
 *   ) : PolylineController<HereActualPolyline>(polylineManager, renderer)
 */

declare class HerePolylineController extends PolylineController<HereActualPolyline> {
    constructor(renderer: HerePolylineOverlayRenderer);
}

/**
 * Port of `HerePolygonOverlayRenderer.kt` in
 * `android-for-here/.../polygon/HerePolygonOverlayRenderer.kt`.
 *
 * First version renders only the simple polygon path (no hole mask tile layer).
 * The Android masking-via-raster-layer workaround for world-mask polygons is
 * intentionally omitted; the JS API handles holes natively via
 * `H.map.Polygon`'s exterior + interior rings.
 */

declare class HerePolygonOverlayRenderer extends AbstractPolygonOverlayRenderer<HereViewHolder, HereActualPolygon> {
    createPolygon(state: PolygonState): Promise<HereActualPolygon | null>;
    updatePolygonProperties({ polygon, current, prev, }: {
        polygon: HereActualPolygon;
        current: PolygonEntity<HereActualPolygon>;
        prev: PolygonEntity<HereActualPolygon>;
    }): Promise<HereActualPolygon | null>;
    removePolygon(entity: PolygonEntity<HereActualPolygon>): Promise<void>;
}

/**
 * Port of `HerePolygonController.kt` in
 * `android-for-here/.../polygon/HerePolygonController.kt`.
 *
 *   class HerePolygonController(
 *       polygonManager: PolygonManagerInterface<HereActualPolygon> = PolygonManager(),
 *       renderer: HerePolygonOverlayRenderer,
 *   ) : PolygonController<HereActualPolygon>(polygonManager, renderer)
 */

declare class HerePolygonController extends PolygonController<HereActualPolygon> {
    constructor(renderer: HerePolygonOverlayRenderer);
}

/**
 * Port of `HereCircleOverlayRenderer.kt` in
 * `android-for-here/.../circle/HereCircleOverlayRenderer.kt`.
 *
 * Like Android (which approximates the circle as a `MapPolygon`), the circle
 * is drawn as a polygon ring from the shared core geometry (`circleToRing`)
 * instead of the native `H.map.Circle`, so the circle shape definition
 * (geodesic vs planar) is unified across providers. The ring is unwrapped
 * around the center longitude; HERE JS accepts out-of-range longitudes
 * (verified against a ±180-crossing ring), so an antimeridian-crossing circle
 * stays continuous without normalize + splitRingByMeridian (splitting also
 * paints a stroke seam along the meridian).
 */

declare class HereCircleOverlayRenderer extends AbstractCircleOverlayRenderer<HereViewHolder, HereActualCircle> {
    createCircle(state: CircleState): Promise<HereActualCircle | null>;
    updateCircleProperties({ circle, current, prev, }: {
        circle: HereActualCircle;
        current: CircleEntity<HereActualCircle>;
        prev: CircleEntity<HereActualCircle>;
    }): Promise<HereActualCircle | null>;
    removeCircle(entity: CircleEntity<HereActualCircle>): Promise<void>;
}

/**
 * Port of `HereCircleController.kt` in
 * `android-for-here/.../circle/HereCircleController.kt`.
 *
 *   class HereCircleController(
 *       circleManager: CircleManager<HereActualCircle> = CircleManager(),
 *       renderer: HereCircleOverlayRenderer,
 *   ) : CircleController<HereActualCircle>(circleManager, renderer)
 */

declare class HereCircleController extends CircleController<HereActualCircle> {
    constructor(renderer: HereCircleOverlayRenderer);
}

/**
 * Port of `HereGroundImageOverlayRenderer.kt` in
 * `android-for-here/.../groundimage/HereGroundImageOverlayRenderer.kt`.
 *
 * Android builds a tile-based `RasterDataSource` + `MapLayer` for each
 * `GroundImageState`. The HERE Maps API for JavaScript exposes `H.map.Overlay`
 * for exactly this purpose — a bitmap draped over a geographic rectangle,
 * with its own opacity — so it is used directly instead of approximating a
 * ground overlay with a fixed-size marker icon.
 */

declare class HereGroundImageOverlayRenderer extends AbstractGroundImageOverlayRenderer<HereViewHolder, HereActualGroundImage> {
    createGroundImage(state: GroundImageState): Promise<HereActualGroundImage | null>;
    updateGroundImageProperties({ groundImage, current, prev, }: {
        groundImage: HereActualGroundImage;
        current: GroundImageEntity<HereActualGroundImage>;
        prev: GroundImageEntity<HereActualGroundImage>;
    }): Promise<HereActualGroundImage | null>;
    removeGroundImage(entity: GroundImageEntity<HereActualGroundImage>): Promise<void>;
}

/**
 * Port of `HereGroundImageController.kt` in
 * `android-for-here/.../groundimage/HereGroundImageController.kt`.
 *
 *   class HereGroundImageController(
 *       groundImageManager: GroundImageManagerInterface<HereActualGroundImage> = GroundImageManager(),
 *       renderer: HereGroundImageOverlayRenderer,
 *   ) : GroundImageController<HereActualGroundImage>(groundImageManager, renderer)
 */

declare class HereGroundImageController extends GroundImageController<HereActualGroundImage> {
    constructor(renderer: HereGroundImageOverlayRenderer);
}

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
interface HereRasterLayerHandle {
    readonly layer: H.map.layer.Layer;
    attached: boolean;
    readonly sourceName: string;
    readonly layerName: string;
    readonly routeId: string | null;
}

/**
 * Port of `HereRasterLayerOverlayRenderer.kt` in
 * `android-for-here/.../raster/HereRasterLayerOverlayRenderer.kt`.
 *
 * Uses the HERE Maps API for JavaScript tile layer stack
 * (`H.map.layer.TileLayer` + `H.map.provider.ImageTileProvider`) instead of
 * `RasterDataSource` + `MapLayerBuilder`.
 *
 * First version supports the `UrlTemplate` and `ArcGisService` source variants
 * (TMS/XYZ).
 *
 * Opacity is applied on the `ImageTileProvider` (its `opacity` constructor
 * option / `setOpacity()`), NOT on the `TileLayer`: in the HERE Maps JS API the
 * opacity lives on the provider — `H.map.layer.TileLayer`/`Layer` have no
 * opacity method — so passing `{ opacity }` to the layer (as this used to)
 * silently did nothing and the raster always rendered fully opaque. This makes
 * the Android per-tile alpha proxy (`HereRasterTileProxyProvider`) unnecessary
 * on the web.
 */

type ActualRasterLayer = HereRasterLayerHandle & object;
declare class HereRasterLayerOverlayRenderer implements RasterLayerOverlayRenderer<ActualRasterLayer> {
    private readonly holder;
    constructor(holder: HereViewHolder);
    onAdd(data: RasterLayerAddParams[]): Promise<(ActualRasterLayer | null)[]>;
    onChange(data: RasterLayerChangeParams<ActualRasterLayer>[]): Promise<(ActualRasterLayer | null)[]>;
    onRemove(data: RasterLayerEntity<ActualRasterLayer>[]): Promise<void>;
    onCameraChanged(_mapCameraPosition: MapCameraPosition): Promise<void>;
    onPostProcess(): Promise<void>;
    private addLayer;
    private updateLayer;
    private removeLayer;
}

/**
 * Port of `HereRasterLayerController.kt` in
 * `android-for-here/.../raster/HereRasterLayerController.kt`.
 *
 * Android's controller also implements `warmupNetworkIfNeeded(holder)` to
 * pre-warm HERE SDK's network stack. The JS API does not require this; the
 * method is exposed as a no-op to keep the controller API aligned.
 */

declare class HereRasterLayerController extends RasterLayerController<HereRasterLayerHandle & object> {
    /**
     * H.map.provider.ImageTileProvider は URL を返す形で、取得そのものは HERE の JS API が行う。
     * android / ios の HERE は対応済みなので、ここは web だけの制約。
     *
     * userAgent はブラウザが上書きを許さないので、どのプロバイダでも web では効かない。
     */
    protected get headerSupport(): RasterHeaderSupport;
    constructor(renderer: HereRasterLayerOverlayRenderer);
    /**
     * Mirrors `warmupNetworkIfNeeded(holder: HereViewHolder)` in Android.
     * The JS API has no equivalent warm-up step, so this is intentionally empty.
     */
    warmupNetworkIfNeeded(): void;
}

/**
 * Port of `HereViewControllerStore.kt` in
 * `android-for-here/.../HereViewControllerStore.kt`.
 *
 *   object HereMapViewControllerStore : StaticHolder<HereMapViewController>() {
 *       fun initSDK(context: Context) { ... SDKNativeEngine.makeSharedInstance(...) }
 *   }
 *
 * On Android this object authenticates the HERE SDK with credentials stored
 * in the AndroidManifest's meta-data. On web the host page is expected to
 * construct `H.service.Platform` directly with its HERE API key and register
 * it via `setHerePlatform(...)` before mounting `<HereMapView2D />`.
 */

declare const HereMapViewControllerStore: {
    initSDK(platform: H.service.Platform): void;
    get(id: string): HereMapViewController | null;
    put(id: string, controller: HereMapViewController): void;
    remove(id: string): void;
    destroy(id: string): void;
    getPlatform(): H.service.Platform | null;
    isInitialized(): boolean;
};
/** Convenience entry used by the provider; mirrors `initSDK(context)`. */
declare function setHerePlatform(platform: H.service.Platform | null): void;
declare function getHerePlatform(): H.service.Platform | null;

/**
 * Port of `HereMapViewController.kt` in
 * `android-for-here/.../HereMapViewController.kt`.
 *
 *   class HereMapViewController(
 *       private val markerController: HereMarkerController,
 *       private val polylineController: HerePolylineController,
 *       private val polygonController: HerePolygonController,
 *       private val groundImageController: HereGroundImageController,
 *       private val circleController: HereCircleController,
 *       private val rasterLayerController: HereRasterLayerController,
 *       override val holder: HereViewHolder,
 *       override val defaultCoroutine: CoroutineScope = ...,
 *       override val mainCoroutine: CoroutineScope = ...,
 *   ) : BaseMapViewController(),
 *       CircleCapableInterface,
 *       HereMapViewControllerInterface,
 *       MapCameraListener,
 *       TapListener,
 *       LongPressListener
 *
 * The HERE JS API provides continuous `mapviewchange` / `mapviewchangeend`
 * events (no separate "move end" callback); Android synthesizes a "move end"
 * via an idle job (CAMERA_MOVE_END_IDLE_MS = 120L). We replicate that here.
 */

declare class HereMapViewController extends BaseMapViewController implements HereMapViewControllerInterface, MapViewControllerInterface {
    readonly holder: HereViewHolder;
    private readonly markerController;
    private readonly polylineController;
    private readonly polygonController;
    private readonly groundImageController;
    private readonly circleController;
    private readonly rasterLayerController;
    private initialized;
    private destroyed;
    /** 範囲・ズーム制限のクランプ。状態を持つのでコンストラクタで組み立てて注入する。 */
    private readonly constraints;
    /** 論理カメラの保持とカメラ変化の解釈。同じくコンストラクタで組み立てる。 */
    private readonly camera;
    private readonly mapDesignType;
    private readonly mapDesignTypeChangeListener;
    /** ドラッグ中だけ使う、掴んだ点とマーカー中心のずれ。 */
    private readonly markerDragOffset;
    /** ジェスチャー処理へ渡す依存一式。private を覗かせずに必要なものだけ束ねる。 */
    private get gestureDeps();
    private readonly onMapChangeHandler;
    private readonly onMapChangeEndHandler;
    private readonly onMapClickHandler;
    private readonly onMapLongClickHandler;
    private readonly onMarkerDragStartHandler;
    private readonly onMarkerDragHandler;
    private readonly onMarkerDragEndHandler;
    constructor({ holder, initialMapDesignType, markerController, polylineController, polygonController, groundImageController, circleController, rasterLayerController, minZoom, maxZoom, restrictBounds, }: {
        holder: HereViewHolder;
        initialMapDesignType: HereMapDesignType;
        markerController: HereMarkerController;
        polylineController: HerePolylineController;
        polygonController: HerePolygonController;
        groundImageController: HereGroundImageController;
        circleController: HereCircleController;
        rasterLayerController: HereRasterLayerController;
        minZoom?: number;
        maxZoom?: number;
        restrictBounds?: GeoRectBounds;
    });
    private uiSettings;
    /** 設定反映へ渡す依存一式。private を覗かせずに必要なものだけ束ねる。 */
    private get settingsDeps();
    applyUISettings(settings: MapUISettings): void;
    setMapDesignType(value: HereMapDesignType): void;
    setMapDesignTypeChangeListener(listener: HereMapDesignTypeChangeHandler, onMapInitialized?: OnMapInitializedHandler): void;
    /**
     * Mirrors `setupListeners()` in Android.
     *
     * HERE Maps API for JavaScript emits only `mapviewchange` (continuous) and
     * `mapviewchangeend`; there is no dedicated "movestart" event. We synthesize
     * it by detecting the transition from idle to moving.
     */
    private setupListeners;
    private detachListeners;
    getCameraPosition(): MapCameraPosition | null;
    getVisualTilt(): number;
    getVisualBearing(): number;
    moveCamera(position: MapCameraPosition): Promise<boolean>;
    animateCamera(position: MapCameraPosition, _durationMillis: number): Promise<boolean>;
    fitBounds(bounds: GeoRectBounds, padding: number): Promise<boolean>;
    private notifyControllersCameraChanged;
    clearOverlays(): Promise<void>;
    /**
     * HERE JS API にはカメラ範囲制限の API が無いため、`constrainLookAt` /
     * `enforceCameraConstraints` によるクランプで実現している（android-sdk の HERE と同じ方針）。
     *
     * ここでは core の `CameraRestriction` をその既存クランプの入力に流し込む。既存実装は
     * カメラ中心だけでなく可視領域全体を矩形内に収める点で android-sdk のクランプより厳格なので、
     * `BaseMapViewController.cameraRestrictionCorrection` には置き換えず温存する。
     */
    setCameraRestriction(restriction: CameraRestriction | null): void;
    destroy(): void;
    /**
     * Shows or hides the native HERE canvas markers. The 2D view hides them while
     * its CSS tilt hack is active (which would otherwise flatten the icons against
     * the ground) and renders upright DOM billboards in their place.
     */
    setNativeMarkersVisible(visible: boolean): void;
    /**
     * Marker states rendered as individual native markers (not tiled into the
     * raster overlay). Only these need the tilted-view DOM billboard fallback;
     * tiled markers are drawn by the raster tile layer, which HERE tilts natively.
     * Returning the tiled markers here too would re-mount tens of thousands of
     * DOM `<img>` nodes whenever the map is tilted, freezing the main thread.
     */
    getNonTiledMarkerStates(): MarkerState[];
    setOnMarkerClickListener(listener: OnMarkerEventHandler | null): void;
    setOnMarkerDragStart(listener: OnMarkerEventHandler | null): void;
    setOnMarkerDrag(listener: OnMarkerEventHandler | null): void;
    setOnMarkerDragEnd(listener: OnMarkerEventHandler | null): void;
    setOnMarkerAnimateStart(listener: OnMarkerEventHandler | null): void;
    setOnMarkerAnimateEnd(listener: OnMarkerEventHandler | null): void;
    setMarkerAnimationOverlayHost(host: ((entry: never) => void) | null): void;
    /**
     * マーカーのヒットテストと配送。カスケードの先頭。
     *
     * 通常のマーカーとタイル方式のマーカーの両方を見る必要があるのでここで持つ。
     */
    protected dispatchMarkerTap(point: GeoPoint): boolean;
}
/** Sentinel enum-like ids; mirrors `HereMapDesign.NormalDay.id` in Android. */
declare const HereDesignId: {
    readonly NormalDay: "normal.day";
    readonly NormalNight: "normal.night";
    readonly Satellite: "satellite.day";
    readonly HybridDay: "hybrid.day";
    readonly HybridNight: "hybrid.night";
    readonly TerrainDay: "terrain.day";
};

/**
 * Port of `HereViewHolder.kt` in `android-for-here/.../HereViewHolder.kt`.
 *
 * The Android holder wraps `MapView`/`MapScene`; here it wraps the HERE Maps
 * API for JavaScript `H.Map` (and exposes its underlying element via the
 * `mapView` field like the sibling providers).
 */

declare class HereViewHolder extends MapViewHolderBase<HTMLElement, H.Map> {
    readonly mapView: HTMLElement;
    readonly map: H.Map;
    readonly behavior: H.mapevents.Behavior;
    private controller;
    constructor(mapView: HTMLElement, map: H.Map, behavior: H.mapevents.Behavior);
    setController(controller: HereMapViewController): void;
    /**
     * Mirrors `toScreenOffset(position: GeoPointInterface): Offset?` in Android.
     */
    toScreenOffset(position: GeoPointInterface): Offset;
    /**
     * Mirrors `fromScreenOffsetSync(offset: Offset): GeoPoint?` in Android.
     */
    fromScreenOffsetSync(offset: Offset): GeoPoint | null;
    /** Convenience helper that mirrors `GeoPoint.from(...)` usage in Android. */
    geoToScreen(position: GeoPointInterface): Offset;
    private mapPixelToViewport;
    private viewportToMapPixel;
}

type HereViewStateInterface = MapViewStateInterface<HereMapDesignType>;
interface HereViewStateParams {
    id?: string;
    mapDesignType?: HereMapDesignType;
    cameraPosition?: MapCameraPosition;
}
declare class HereViewState extends MapViewState<HereMapDesignType> implements HereViewStateInterface {
    private _mapDesignType;
    constructor({ id, mapDesignType, cameraPosition, }?: HereViewStateParams);
    get mapDesignType(): HereMapDesignType;
    set mapDesignType(value: HereMapDesignType);
}
declare function useHereViewState(params?: HereViewStateParams): HereViewStateInterface;

/**
 * Provider entry-point that mirrors the factory portion of `HereMapView.kt`
 * in `android-for-here/.../HereMapView.kt` (the Android composable handles
 * initialization inline; on web we keep a dedicated `MapProvider` subclass
 * like the other react-for-* packages).
 */

interface HereConfig extends MapConfig {
    /** The initial base map design. */
    mapDesignType: HereMapDesignType;
    minZoom?: number;
    maxZoom?: number;
    /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
    restrictBounds?: GeoRectBounds;
    /** Optional pixel ratio override (default: devicePixelRatio). */
    pixelRatio?: number;
    /** Optional initial `H.service.Platform` (provided by the host page). */
    platform?: H.service.Platform;
    /** Marker tiling options; large static marker sets render as a raster overlay. */
    markerTilingOptions?: MarkerTilingOptions;
}
declare class HereProvider extends MapProvider {
    private initializing;
    private resizeObserver;
    private resizeFrame;
    initialize(config: HereConfig): Promise<MapViewControllerInterface>;
    private buildController;
    destroy(): void;
}

interface HereMapView2DProps extends MapViewBaseProps<HereViewStateInterface> {
    minZoom?: number;
    maxZoom?: number;
    /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
    restrictBounds?: GeoRectBounds;
    /** Optional pixel ratio override (default: devicePixelRatio). */
    pixelRatio?: number;
    /** Tiling options for large marker sets (renders them as a raster overlay). */
    markerTilingOptions?: MarkerTilingOptions;
    /**
     * The HERE `H.service.Platform` instance configured with your credentials.
     * If omitted, a default unauthenticated platform is constructed. Provide
     * this from your own code so that the host page keeps control of HERE
     * credentials (mirrors AndroidManifest's `HERE_ACCESS_KEY_ID/SECRET`).
     */
    platform?: H.service.Platform;
    className?: string;
    containerStyle?: CSSProperties;
    onError?: (error: Error) => void;
    children?: ReactNode;
}
declare function HereMapView2D({ state, onMapLoaded, onMapClick, onMapLongClick, onCameraMoveStart, onCameraMove, onCameraMoveEnd, minZoom, maxZoom, restrictBounds, cameraRestriction, pixelRatio, platform, markerTilingOptions, className, containerStyle, onError, children, }: HereMapView2DProps): react.JSX.Element;

/**
 * 統一ズーム（Google Maps 基準・256px タイル）⇄ 高度の変換。
 *
 * HERE Maps API for JavaScript は平坦な Web Mercator で描き、ズームの取り方が
 * どの緯度でも Google / MapLibre と同じなので、here⇄google のズーム変換は恒等。
 * つまりオフセットは 0。`cos(latitude)` はズームを実距離（メートル）へ直すときだけ効く。
 *
 * **ネイティブの HERE SDK とは違う。** android-for-here / ios-for-here は距離基準の
 * カメラで緯度補正が要り、しかも緯度・tilt のクランプが無いのでコアの実装に寄せていない。
 * web だけがこの形。
 *
 * 換算式はコアの {@link WebMercatorZoomAltitudeConverter} にある。
 */
declare class ZoomAltitudeConverter extends WebMercatorZoomAltitudeConverter {
    static readonly HERE_ZOOM_TO_GOOGLE_ZOOM_AT_EQUATOR = 0;
    constructor(zoom0Altitude?: number);
    static hereZoomToGoogleZoom(hereZoom: number, _latitude: number): number;
    static googleZoomToHereZoom(googleZoom: number, _latitude: number): number;
}

/**
 * Port of `MapCameraPosition.kt` in `android-for-here/.../MapCameraPosition.kt`.
 *
 * The HERE Maps API for JavaScript exposes look-at state through
 * `H.Map.getViewModel().getLookAt()` (`{ position, zoom, bearing, tilt }`),
 * so the conversion mirrors the Android helpers `toHereDisplayCamera()` and
 * `toMapCameraUpdate()` but targets the JS ViewModel.
 */

interface HereDisplayCamera {
    target: MapCameraPosition['position'];
    tiltDeg: number;
    hereZoomLevel: number;
    bearing: number;
}
/**
 * Mirrors `MapCameraPosition.toHereDisplayCamera()` in Android.
 * For positive tilt, returns the camera as-is. For negative tilt (which HERE
 * cannot represent directly), shifts the ground target forward and renders
 * with abs(tilt), exactly like the Android implementation.
 */
declare function toHereDisplayCamera(position: MapCameraPosition, { snapZoom }?: {
    snapZoom?: boolean;
}): HereDisplayCamera;
/** Mirrors `MapCameraPosition.toMapCameraUpdate()` in Android. */
declare function toHereLookAtData(position: MapCameraPosition, options?: {
    snapZoom?: boolean;
}): H.map.ViewLookAtData;
/** Mirrors `MapCameraPosition.from(position: MapCameraPositionInterface)`. */
declare function mapCameraPositionFrom(position: MapCameraPositionInterface): MapCameraPosition;
/**
 * Mirrors `MapCamera.State.toMapCameraPosition(logicalTiltHint)` in Android.
 * HERE JS ViewModel reports a positive tilt; pass the last requested tilt to
 * recover the original logical position when the camera was shifted to fake a
 * negative tilt.
 */
declare function lookAtToMapCameraPosition(lookAt: H.map.ViewLookAt, logicalTiltHint?: number | null): MapCameraPosition;

/**
 * Mirrors `GeoPoint.kt` in `android-for-here/.../GeoPoint.kt`.
 *
 * `GeoPoint.toGeoCoordinates()` / `GeoCoordinates.toGeoPoint()` /
 * `GeoCoordinates.toUpdate()` / `GeoOrientation.toUpdate()` bridge between
 * MapConductor `GeoPoint` and the HERE SDK for Mobile types. The HERE Maps
 * API for JavaScript uses `H.geo.GeoPoint`/`H.geo.GeoCoord` with `lat`/`lng`
 * (instead of latitude/longitude), so the conversion is direct.
 */

declare function toGeoCoordinates(position: GeoPointInterface): H.geo.GeoCoord;
declare function toGeoPoint(coord: H.geo.GeoCoord): GeoPoint;
declare function geoPointFromLatLng(lat: number, lng: number, alt?: number): GeoPoint;

/**
 * Mirrors `GeoRectBounds.kt` in `android-for-here/.../GeoRectBounds.kt`.
 *
 * Bridges MapConductor `GeoRectBounds` and the HERE `H.geo.Rect`.
 */

declare function toGeoRect(bounds: GeoRectBounds): H.geo.Rect | null;
declare function toGeoRectBounds(rect: H.geo.Rect): GeoRectBounds;

/**
 * Port of `BitmapIcon.kt` in `android-for-here/.../BitmapIcon.kt`.
 *
 *   internal fun BitmapIcon.toMapImage(): MapImage
 *   internal fun BitmapIcon.toAnchor2D(): Anchor2D
 *
 * The JS API uses `H.map.Icon` (HTMLImageElement/Canvas + size + anchor), not
 * `MapImage`/`Anchor2D`. The bridge keeps the same function names so the
 * marker renderer reads the same way as Android.
 */

declare function toMapImage(bitmapIcon: BitmapIcon): Promise<H.map.Icon>;
declare function toAnchor2D(bitmapIcon: BitmapIcon): H.math.Point<number>;

/**
 * Port of `HereViewInitOptions.kt` in
 * `android-for-here/.../HereViewInitOptions.kt`.
 *
 *   data class HereViewInitOptions(
 *       val scheme: MapScheme = MapScheme.NORMAL_DAY,
 *   )
 *
 * On Android this is fed to `HereMapView`; in the JS API the equivalent is
 * the initial base layer / style of the `H.Map`.
 */

interface HereViewInitOptions {
    readonly scheme: string;
}

export { type HereActualCircle, type HereActualGroundImage, type HereActualMarker, type HereActualPolygon, type HereActualPolyline, type HereConfig, HereDesignId, HereMapDesign, type HereMapDesignType, type HereMapDesignTypeChangeHandler, HereMapView2D, type HereMapView2DProps, HereMapViewController, type HereMapViewControllerInterface, HereMapViewControllerStore, HereProvider, HereViewHolder, type HereViewInitOptions, HereViewState, type HereViewStateInterface, type HereViewStateParams, ZoomAltitudeConverter, geoPointFromLatLng, getHerePlatform, lookAtToMapCameraPosition, mapCameraPositionFrom, setHerePlatform, toAnchor2D, toGeoCoordinates, toGeoPoint, toGeoRect, toGeoRectBounds, toHereDisplayCamera, toHereLookAtData, toMapImage, useHereViewState };
