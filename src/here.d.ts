/**
 * Minimal ambient declarations for the HERE Maps API for JavaScript (v3.1).
 *
 * The HERE Maps API for JavaScript is loaded from a CDN as a global `H`
 * namespace; consumers are expected to add the corresponding `<script>` tags
 * (core / service / ui / mapevents) themselves. These typings are intentionally
 * loose (most calls accept/return `any`) so that this package can mirror the
 * sibling Android SDK (`com.here.sdk.*`) class and property names without
 * becoming brittle to upstream API drift.
 *
 * Class/namespace names match the HERE Maps API for JavaScript reference:
 *   https://www.here.com/docs/bundle/maps-api-for-javascript-api-reference/page/api-reference-harp.html
 */
declare global {
  namespace H {
    namespace service {
      class Platform {
        constructor(options?: Record<string, unknown>);
        createDefaultLayers(options?: Record<string, unknown>): DefaultLayers;
        // Raster Tile API v3 (`maps.hereapi.com/v3/...`). Used instead of
        // `createDefaultLayers()`'s bundled `raster.*` layers, which are wired
        // to HERE's retired Map Tile API v2 and now return HTTP 410 for every
        // tile (see the comment on `resolveHereBaseLayer`).
        getRasterTileService(options?: Record<string, unknown>): unknown;
        getOMTService(options?: Record<string, unknown>): unknown;
        getMetaInfo(): unknown;
        configure(settings?: unknown): void;
      }

      // Mirrors `H.service.Platform#createDefaultLayers()`'s return shape from
      // the HERE Maps API for JavaScript quick-start guide. `base`/`map` are the
      // labels-free and labels-included variants of each scheme respectively.
      interface DefaultLayers {
        vector: {
          normal: { map: map.layer.Layer; [key: string]: map.layer.Layer };
        };
        raster: {
          // `normal` is the only scheme with a night variant (`basenight`/`mapnight`).
          normal: {
            map: map.layer.Layer;
            base: map.layer.Layer;
            mapnight: map.layer.Layer;
            basenight: map.layer.Layer;
            [key: string]: map.layer.Layer;
          };
          satellite: { map: map.layer.Layer; base: map.layer.Layer; [key: string]: map.layer.Layer };
          terrain: { map: map.layer.Layer; base: map.layer.Layer; [key: string]: map.layer.Layer };
        };
      }

      namespace rasterTile {
        class Provider extends map.Provider {
          constructor(service: unknown, options?: Record<string, unknown>);
        }
      }
    }

    class Map {
      static readonly EngineType: { P2D: number; WEBGL: number; HARP: number };

      constructor(
        element: HTMLElement,
        layers: any,
        options?: Record<string, unknown>,
      );

      getBaseLayer(): any;
      setBaseLayer(layer: any): void;
      getLayers(): any;
      setLayers(layers: any): void;
      addLayer(layer: any): void;
      removeLayer(layer: any): void;

      getViewModel(): map.ViewModel;
      setViewModel(view: map.ViewModel): void;

      getCamera(): { getZoomLevel(): number; setZoomLevel(z: number, opts?: any): void };
      setZoom(z: number, opts?: any): void;
      getZoom(): number;
      setCenter(center: geo.GeoCoord, opts?: any): void;
      getCenter(): geo.GeoCoord;

      geoToScreen(point: geo.GeoCoord): { x: number; y: number };
      screenToGeo(x: number, y: number): geo.GeoCoord;

      addEventListener(type: string, handler: (event: map.MapEvent) => void, capture?: boolean): void;
      removeEventListener(type: string, handler: (event: map.MapEvent) => void, capture?: boolean): void;

      addObject(object: any): any;
      removeObject(object: any): any;
      addObjects(objects: any[]): any[];
      removeObjects(objects: any[]): any[];
      getObjects(): any[];

      getElement(): HTMLElement;
      getViewPort(): {
        width: number;
        height: number;
        center: geo.GeoCoord;
        boundingBox: geo.GeoRect;
        resize(): void;
      };
      dispose(): void;
    }

    namespace map {
      namespace style {
        // Mirrors `H.map.style.*` constants from the HERE Maps API for JavaScript.
        const NormalDay: string;
        const NormalDayGrey: string;
        const NormalDayCustom: string;
        const NormalNight: string;
        const NormalNightGrey: string;
        const ReducedDay: string;
        const ReducedNight: string;
        const SatelliteDay: string;
        const HybridDay: string;
        const HybridGreyDay: string;
        const HybridNight: string;
        const TerrainDay: string;
      }

      // Mirrors `MapScheme` from the HERE SDK for Mobile (Lite/Explore).
      // In the JS API the same role is played by a style string, so we keep the
      // name aligned with the Android alias `HereMapDesignType`.
      type MapScheme = string;

      interface ViewModel {
        getLookAtData(): ViewLookAt;
        // The second argument is a raw "animate" boolean, not an options
        // object — passing any truthy object (even `{ animate: false }`)
        // is coerced to `true` and always animates.
        setLookAtData(data: ViewLookAtData, animate?: boolean): void;
        getPadding(): { top: number; left: number; bottom: number; right: number };
      }

      interface ViewLookAt {
        position: GeoCoord;
        zoom: number;
        heading: number;
        tilt: number;
      }

      interface ViewLookAtData {
        position?: GeoCoord;
        zoom?: number;
        heading?: number;
        tilt?: number;
        // When set, the view model computes position/zoom to fit this
        // rectangle instead of using `position`/`zoom` directly.
        bounds?: geo.Rect;
      }

      class Object {
        getId(): string;
        addEventListener(type: string, handler: (event: MapEvent) => void, capture?: boolean): void;
        removeEventListener(type: string, handler: (event: MapEvent) => void, capture?: boolean): void;
        getData(): unknown;
        setData(data: unknown): void;
        getProvider(): any;
        setVisibility(visible: boolean): void;
        isVisible(): boolean;
        getZIndex(): number;
        setZIndex(z: number): void;
        getBoundingBox(): GeoRect;
      }

      class Marker extends Object {
        draggable: boolean;
        constructor(coordinate: GeoCoord, options?: MarkerOptions);
        getGeometry(): GeoCoord;
        setGeometry(coordinate: GeoCoord): void;
        getIcon(): Icon;
        setIcon(icon: Icon): void;
      }

      interface MarkerOptions {
        icon?: Icon;
        volatility?: boolean;
        zIndex?: number;
        data?: unknown;
        min?: number;
        max?: number;
        visibility?: boolean;
      }

      class DomMarker extends Marker {}
      class AbstractMarker extends Marker {}

      // Renders a bitmap draped over a geographic rectangle — the JS API's
      // native ground-overlay primitive (distinct from Marker/Icon, which are
      // fixed-size and not georeferenced to an area).
      class Overlay extends Object {
        constructor(
          bounds: geo.Rect,
          bitmap: string | HTMLImageElement | HTMLCanvasElement,
          options?: OverlayOptions,
        );
        getBoundingBox(): geo.Rect;
        setBoundingBox(boundingBox: geo.Rect): Overlay;
        getBitmap(): HTMLImageElement | HTMLCanvasElement | null;
        setBitmap(bitmap: string | HTMLImageElement | HTMLCanvasElement): Overlay;
        getOpacity(): number;
        setOpacity(opacity: number): Overlay;
      }

      interface OverlayOptions {
        min?: number;
        max?: number;
        opacity?: number;
        visibility?: boolean;
        zIndex?: number;
        data?: unknown;
      }

      class Polyline extends Object {
        constructor(points: any, options?: PolylineOptions);
        setStyle(options: StyleOptions): void;
        getStyle(): StyleOptions | null;
        getGeometry(): any;
      }

      interface PolylineOptions {
        style?: StyleOptions;
        precision?: number;
        arrows?: unknown;
        volatility?: boolean;
        zIndex?: number;
        data?: unknown;
        visibility?: boolean;
      }

      class Polygon extends Object {
        constructor(linearRings: any, options?: PolygonOptions);
        setStyle(options: StyleOptions): void;
        getStyle(): StyleOptions | null;
        getGeometry(): any;
        getExterior(): any;
      }

      interface PolygonOptions {
        style?: StyleOptions;
        precision?: number;
        zIndex?: number;
        data?: unknown;
        visibility?: boolean;
      }

      class Circle extends Object {
        constructor(center: GeoCoord, radius: number, options?: CircleOptions);
        getCenter(): GeoCoord;
        getRadius(): number;
        setCenter(center: GeoCoord): void;
        setRadius(radius: number): void;
        getStyle(): StyleOptions | null;
        setStyle(options: StyleOptions): void;
      }

      interface CircleOptions {
        style?: StyleOptions;
        volatility?: boolean;
        zIndex?: number;
        data?: unknown;
        visibility?: boolean;
      }

      interface StyleOptions {
        strokeColor?: string;
        fillColor?: string;
        lineWidth?: number;
        lineCap?: string;
        lineJoin?: string;
        miterLimit?: number;
        lineDash?: number[];
      }

      class Provider {
        addEventListener(type: string, handler: (event: any) => void): void;
        removeEventListener(type: string, handler: (event: any) => void): void;
      }

      // `Layer` and its subclasses live under the nested `H.map.layer`
      // namespace, not directly on `H.map`.
      namespace layer {
        class Layer {
          getProvider(): Provider;
          isValid(): boolean;
          setMin(min: number): void;
          setMax(max: number): void;
        }
        class TileLayer extends Layer {
          constructor(provider: any, options?: Record<string, unknown>);
        }
        class ObjectLayer extends Layer {
          constructor(provider: any);
        }
      }

      namespace provider {
        // Single options object — `getURL` is a property of it, not a second
        // positional constructor argument (confirmed against HERE's official
        // ImageTileProvider.Options reference and example code).
        class ImageTileProvider extends Provider {
          constructor(options: ImageTileProviderOptions);
        }

        interface ImageTileProviderOptions {
          uri?: string;
          min?: number;
          max?: number;
          tileSize?: number;
          opacity?: number;
          crossOrigin?: string | boolean;
          getURL(column: number, row: number, zoom: number): string | undefined;
        }
      }

      class Icon {
        constructor(
          bitmap: HTMLImageElement | HTMLCanvasElement | string | ImageData,
          options?: IconOptions,
        );
        getSize(): math.Point<number>;
        setSize(size: math.Point<number>): void;
        getAnchor(): math.Point<number>;
        setAnchor(anchor: math.Point<number>): void;
      }

      interface IconOptions {
        // `size` takes a `{w, h}` pair, distinct from `anchor`'s `{x, y}` point.
        size?: { w: number; h: number };
        anchor?: math.Point<number> | { x: number; y: number };
        hitArea?: unknown;
        asCanvas?: boolean;
        opacity?: number;
      }

      interface MapEvent {
        target: H.Map | Object;
        type: string;
        currentPointer?: Pointer;
        map?: H.Map;
        point?: { x: number; y: number };
        geo?: GeoCoord;
        newLookAt?: ViewLookAt;
      }

      interface Pointer {
        type: string;
        viewportX: number;
        viewportY: number;
      }
    }

    namespace geo {
      interface GeoCoord {
        lat: number;
        lng: number;
        alt?: number;
      }

      class Point implements GeoCoord {
        lat: number;
        lng: number;
        alt: number;
        constructor(lat: number, lng: number, alt?: number);
      }

      class Rect {
        constructor(top?: number, left?: number, bottom?: number, right?: number);
        getTopLeft(): GeoCoord;
        getTopRight(): GeoCoord;
        getBottomLeft(): GeoCoord;
        getBottomRight(): GeoCoord;
        getCenter(): GeoCoord;
        contains(point: GeoCoord): boolean;
        equals(other: Rect, epsilon?: number): boolean;
        isEmpty(): boolean;
        mergePoint(point: GeoCoord): Rect;
      }

      class LineString {
        constructor();
        pushPoint(point: GeoCoord): void;
      }

      class Polygon {
        constructor(exterior: LineString, interiors?: LineString[]);
        getExterior(): LineString;
        getInteriors(): LineString[];
      }
    }

    namespace math {
      class Point<T = number> {
        x: T;
        y: T;
        constructor(x: T, y: T);
      }
    }

    namespace ui {
      class UI {
        constructor(map: H.Map, options?: Record<string, unknown>);
      }
    }

    namespace mapevents {
      class MapEvents {
        constructor(map: H.Map);
        dispose(): void;
      }

      // Wraps a `MapEvents` instance (not the `H.Map` itself) to enable the
      // default pan/zoom/tilt gestures.
      class Behavior {
        constructor(events: MapEvents, options?: Record<string, unknown>);
        disable(): void;
        enable(): void;
      }
    }

  }
}

export {};
