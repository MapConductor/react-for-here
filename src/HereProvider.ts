/**
 * Provider entry-point that mirrors the factory portion of `HereMapView.kt`
 * in `android-for-here/.../HereMapView.kt` (the Android composable handles
 * initialization inline; on web we keep a dedicated `MapProvider` subclass
 * like the other react-for-* packages).
 */
import {
  MapProvider,
  MarkerTilingOptions,
  type MapConfig,
  type MapViewControllerInterface,
  type GeoRectBounds,
} from '@mapconductor/js-sdk-core';
import type { HereMapDesignType } from './HereMapDesign';
import { HereMapViewController, resolveHereBaseLayer } from './HereMapViewController';
import { HereViewHolder } from './HereViewHolder';
import { HereMarkerController } from './marker/HereMarkerController';
import { HerePolylineController } from './polyline/HerePolylineController';
import { HerePolygonController } from './polygon/HerePolygonController';
import { HereCircleController } from './circle/HereCircleController';
import { HereGroundImageController } from './groundimage/HereGroundImageController';
import { HereRasterLayerController } from './raster/HereRasterLayerController';
import { HerePolylineOverlayRenderer } from './polyline/HerePolylineOverlayRenderer';
import { HerePolygonOverlayRenderer } from './polygon/HerePolygonOverlayRenderer';
import { HereCircleOverlayRenderer } from './circle/HereCircleOverlayRenderer';
import { HereGroundImageOverlayRenderer } from './groundimage/HereGroundImageOverlayRenderer';
import { HereRasterLayerOverlayRenderer } from './raster/HereRasterLayerOverlayRenderer';
import { getHerePlatform, setHerePlatform } from './HereViewControllerStore';

export interface HereConfig extends MapConfig {
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

export class HereProvider extends MapProvider {
  // Concurrent initialize calls share one construction. destroy() clears this
  // reference so React StrictMode's next effect cannot reuse a destroyed map.
  private initializing: Promise<MapViewControllerInterface> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeFrame: number | null = null;

  async initialize(config: HereConfig): Promise<MapViewControllerInterface> {
    if (this.controller) return this.controller;
    if (this.initializing) return this.initializing;

    const initialization = this.buildController(config);
    this.initializing = initialization;
    const clearInitialization = () => {
      if (this.initializing === initialization) {
        this.initializing = null;
      }
    };
    void initialization.then(clearInitialization, clearInitialization);
    return initialization;
  }

  private async buildController(config: HereConfig): Promise<MapViewControllerInterface> {
    const container =
      typeof config.container === 'string'
        ? document.getElementById(config.container)
        : config.container;

    if (!container) {
      throw new Error('Container element not found');
    }

    if (
      config.minZoom !== undefined &&
      config.maxZoom !== undefined &&
      config.minZoom > config.maxZoom
    ) {
      throw new Error('minZoom must be less than or equal to maxZoom');
    }
    const initial = config.initCameraPosition;
    const initialCenter = initial?.position ?? { latitude: 0, longitude: 0 };
    const bounds = config.restrictBounds;
    const center = {
      latitude: clamp(
        initialCenter.latitude,
        bounds?.southWest?.latitude,
        bounds?.northEast?.latitude,
      ),
      longitude: clamp(
        initialCenter.longitude,
        bounds?.southWest?.longitude,
        bounds?.northEast?.longitude,
      ),
    };
    const zoom = clamp(initial?.zoom ?? 2, config.minZoom, config.maxZoom);

    // Mirrors `HereMapViewControllerStore.initSDK(context)` in Android.
    if (config.platform) {
      setHerePlatform(config.platform);
    }
    const platform = getHerePlatform() ?? createDefaultPlatform();
    if (!getHerePlatform()) setHerePlatform(platform);

    const map = new H.Map(
      container,
      resolveHereBaseLayer(platform, config.mapDesignType),
      {
        center: { lat: center.latitude, lng: center.longitude },
        zoom,
        pixelRatio: config.pixelRatio ?? window.devicePixelRatio,
        // The WebGL renderer in HERE Maps API 3.1 flips Raster Tile API v3
        // textures vertically. P2D renders the tiles in their source
        // orientation and must match the provider's engine type.
        engineType: H.Map.EngineType.P2D,
      },
    );
    // Enable basic pan/zoom interactions. Mirrors the implicit behaviour of
    // MapView.gestures in Android. `Behavior` wraps the `MapEvents` instance,
    // not the map directly.
    const mapEvents = new H.mapevents.MapEvents(map);
    const behavior = new H.mapevents.Behavior(mapEvents);

    const holder = new HereViewHolder(container, map, behavior);
    const markerController = HereMarkerController.create(
      holder,
      config.markerTilingOptions ?? MarkerTilingOptions.Default,
    );
    const polylineController = new HerePolylineController(new HerePolylineOverlayRenderer(holder));
    const polygonController = new HerePolygonController(new HerePolygonOverlayRenderer(holder));
    const circleController = new HereCircleController(new HereCircleOverlayRenderer(holder));
    const groundImageController = new HereGroundImageController(
      new HereGroundImageOverlayRenderer(holder),
    );
    const rasterLayerController = new HereRasterLayerController(
      new HereRasterLayerOverlayRenderer(holder),
    );

    const ctrl = new HereMapViewController({
      holder,
      initialMapDesignType: config.mapDesignType,
      markerController,
      polylineController,
      polygonController,
      circleController,
      groundImageController,
      rasterLayerController,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      restrictBounds: config.restrictBounds,
    });
    // Apply the initial design type now that the controller is wired up.
    ctrl.setMapDesignType(config.mapDesignType);

    this.controller = ctrl;
    let previousWidth = container.clientWidth;
    let previousHeight = container.clientHeight;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        const nextWidth = container.clientWidth;
        const nextHeight = container.clientHeight;
        if (
          nextWidth <= 0 ||
          nextHeight <= 0 ||
          (nextWidth === previousWidth && nextHeight === previousHeight)
        ) {
          return;
        }
        previousWidth = nextWidth;
        previousHeight = nextHeight;
        if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = requestAnimationFrame(() => {
          this.resizeFrame = null;
          map.getViewPort().resize();
        });
      });
      this.resizeObserver.observe(container);
    }
    return ctrl;
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.resizeFrame !== null) {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = null;
    }
    this.controller?.destroy();
    this.controller = null;
    // React StrictMode can tear down the first effect before initialize()'s
    // promise callback runs. Do not let the next effect reuse the controller
    // that was just destroyed.
    this.initializing = null;
  }
}

function createDefaultPlatform(): H.service.Platform {
  return new H.service.Platform({});
}

function clamp(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}
