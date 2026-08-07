/**
 * Web `<HereMapView2D />` React component for the HERE Maps API for JavaScript.
 *
 * Mirrors the structure of Android `HereMapView.kt`, but is named 2D because
 * HERE Maps API for JavaScript v3 does not support globe projection like the
 * native HERE SDK view can. On web we use the same `MapContext` /
 * `MapViewScopeProvider` plumbing the other providers use.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  InfoBubbleOverlay,
  MapContext,
  MapViewScope,
  MapServiceRegistryProvider,
  MapViewScopeProvider,
  MarkerAnimationLayer,
  MapAttributionOverlay,
  type InfoBubbleEntry,
} from '@mapconductor/js-sdk-react';
import {
  useCameraRestriction,
  useMapUISettings,
  useMarkerRenderingSupport,
} from '@mapconductor/js-sdk-react/internal';
import {
  createDefaultIcon,
  type GeoPoint,
  type GeoRectBounds,
  type MapCameraPosition,
  type MapViewBaseProps,
  type MarkerAnimationOverlayEntry,
  type MarkerState,
  type MarkerTilingOptions,
  type OverlayCollector,
} from '@mapconductor/js-sdk-core';
import { HereProvider, type HereConfig } from './HereProvider';
import type { HereViewStateInterface } from './HereViewState';
import type { HereMapViewController } from './HereMapViewController';

export interface HereMapView2DProps extends MapViewBaseProps<HereViewStateInterface> {
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

/**
 * While the 2D view fakes tilt with a CSS `rotateX`, native HERE markers would
 * be flattened against the ground, so they're hidden and their upright
 * "billboards" are drawn here instead. This uses a single `<canvas>` (drawn on
 * a rAF so markers stay glued to the map during pans/zooms) rather than one DOM
 * `<img>` per marker — mounting tens of thousands of DOM nodes on tilt froze the
 * main thread. Only *non-tiled* markers are drawn; tiled markers are painted by
 * the raster tile layer, which HERE tilts natively. The canvas is draw-only
 * (`pointer-events: none`); clicks flow through the map's tap handler, which
 * hit-tests markers in tilt-aware screen space.
 */
function HereTiltMarkerCanvas({
  controller,
  active,
}: {
  controller: HereMapViewController;
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const images = new Map<string, HTMLImageElement>();
    const imageFor = (url: string): HTMLImageElement | null => {
      let img = images.get(url);
      if (!img) {
        img = new Image();
        img.src = url;
        images.set(url, img);
      }
      return img.complete && img.naturalWidth > 0 ? img : null;
    };

    let raf = 0;
    const draw = () => {
      const parent = canvas.parentElement;
      const width = parent?.clientWidth ?? 0;
      const height = parent?.clientHeight ?? 0;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const holder = controller.holder;
      const items = controller
        .getNonTiledMarkerStates()
        // Skip markers that are currently animating (Drop/Bounce): the
        // screen-space animation overlay draws those, so drawing them here too
        // would leave a static duplicate sitting behind the animated icon.
        .filter((marker) => marker.getAnimation() == null)
        .map((marker) => {
          const bitmapIcon = (marker.icon ?? createDefaultIcon()).toBitmapIcon();
          const screen = holder.toScreenOffset(marker.position);
          return { bitmapIcon, x: screen.x, y: screen.y };
        })
        // Nearer markers (lower on screen) paint last so they overlap the ones
        // behind them, matching the tilted perspective.
        .sort((a, b) => a.y - b.y);

      for (const { bitmapIcon, x, y } of items) {
        const img = imageFor(bitmapIcon.url);
        if (!img) continue;
        const { width: w, height: h } = bitmapIcon.size;
        ctx.drawImage(img, x - bitmapIcon.anchor.x * w, y - bitmapIcon.anchor.y * h, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, controller]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, zIndex: 600, pointerEvents: 'none' }}
    />
  );
}

export function HereMapView2D({
  state,
  onMapLoaded,
  onMapClick,
  onMapLongClick,
  onCameraMoveStart,
  onCameraMove,
  onCameraMoveEnd,
  minZoom,
  maxZoom,
  restrictBounds,
  cameraRestriction,
  pixelRatio,
  platform,
  markerTilingOptions,
  className,
  containerStyle,
  onError,
  children,
}: HereMapView2DProps) {
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [provider] = useState(() => new HereProvider());
  const [scope] = useState(() => new MapViewScope());
  const [controller, setController] = useState<HereMapViewController | null>(null);
  const [isReady, setIsReady] = useState(false);
  // `onMapLoaded` と同じ瞬間を「値」として持つ。イベントを取り逃した後から
  // マウントした子（examples の Three.js overlay 等）も読めるようにするため。
  const [isLoaded, setIsLoaded] = useState(false);
  const typedControllerRef = useRef<HereMapViewController | null>(null);
  const bridgeUnsubs = useRef<(() => void)[]>([]);
  const [bubbleEntries, setBubbleEntries] = useState<InfoBubbleEntry[]>([]);
  const [animationEntries, setAnimationEntries] = useState<MarkerAnimationOverlayEntry[]>([]);
  const [markerStates, setMarkerStates] = useState<MarkerState[]>([]);
  const [, setCameraTick] = useState(0);
  const [visualTilt, setVisualTilt] = useState(() => state.cameraPosition.tilt);
  const [visualBearing, setVisualBearing] = useState(() => state.cameraPosition.bearing);
  const experimentalTilt = Math.min(60, Math.abs(visualTilt));
  // While tilted, the CSS `rotateX` below lays the native canvas markers flat
  // against the ground. We hide them and draw upright DOM billboards instead.
  const isTilted = experimentalTilt > 0.5;
  // The oversized (200%) map plane exists only so the CSS rotateX/rotateZ tilt
  // hack has content to fill the exposed edges. When the map is flat and
  // north-up (the common case) it serves no purpose and actively hurts: it
  // renders the map — and HERE's copyright/logo — into a plane twice the
  // viewport that gets clipped, hiding the attribution and enlarging the map's
  // internal pixel space (which threw off tap hit-testing). So only expand and
  // transform the plane while actually tilted or rotated; otherwise fill the
  // container exactly 1:1.
  const usesTiltPlane = experimentalTilt > 0.5 || Math.abs(visualBearing) > 0.01;
  const mapPlaneStyle: CSSProperties = usesTiltPlane
    ? {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '200%',
        height: '200%',
        transform: `translate(-50%, -50%) rotateZ(${-visualBearing}deg) rotateX(${experimentalTilt}deg)`,
        transformOrigin: '50% 50%',
        transformStyle: 'flat',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
      }
    : {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      };

  const onMapLoadedRef = useRef(onMapLoaded);
  const onMapClickRef = useRef(onMapClick);
  const onMapLongClickRef = useRef(onMapLongClick);
  const onCameraMoveStartRef = useRef(onCameraMoveStart);
  const onCameraMoveRef = useRef(onCameraMove);
  const onCameraMoveEndRef = useRef(onCameraMoveEnd);
  const onErrorRef = useRef(onError);
  onMapLoadedRef.current = onMapLoaded;
  onMapClickRef.current = onMapClick;
  onMapLongClickRef.current = onMapLongClick;
  onCameraMoveStartRef.current = onCameraMoveStart;
  onCameraMoveRef.current = onCameraMove;
  onCameraMoveEndRef.current = onCameraMoveEnd;
  onErrorRef.current = onError;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      typedControllerRef.current?.holder.map.getViewPort().resize();
    });
    return () => cancelAnimationFrame(frame);
  }, [experimentalTilt, visualBearing]);

  // Swap between native canvas markers (untilted) and upright DOM billboards
  // (tilted). markerStates is a dep so markers added while tilted are hidden
  // as soon as they appear.
  useEffect(() => {
    typedControllerRef.current?.setNativeMarkersVisible(!isTilted);
  }, [isTilted, markerStates]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    setIsReady(false);
    setIsLoaded(false);

    const config: HereConfig = {
      container: containerRef.current,
      initCameraPosition: state.cameraPosition,
      mapDesignType: state.mapDesignType,
      minZoom,
      maxZoom,
      restrictBounds,
      pixelRatio,
      platform,
      markerTilingOptions,
    };

    provider
      .initialize(config)
      .then((rawController) => {
        if (cancelled) return;
        const ctrl = rawController as HereMapViewController;
        typedControllerRef.current = ctrl;
        // Hide native markers up front when starting tilted so markers rendered
        // by the overlay pipeline (below) are created already hidden, avoiding a
        // flattened-icon flash before the billboard effect runs.
        ctrl.setNativeMarkersVisible(experimentalTilt <= 0.5);
        state.setController(ctrl);
        state.setCameraPositionChangeListener((camera) => {
          setVisualTilt(camera.tilt);
          setVisualBearing(camera.bearing);
          setCameraTick((t) => t + 1);
        });
        setController(ctrl);

        // HERE renders its logo + copyright (the `.H_imprint` block) inside the
        // map's inner element — which is the CSS-transformed/oversized tilt
        // plane, so while tilted the required attribution gets clipped and
        // skewed. Move it into the untransformed outer container so the HERE
        // logo and copyright stay visible and upright in every orientation.
        const moveImprint = () => {
          const outer = outerContainerRef.current;
          const imprint = containerRef.current?.querySelector<HTMLElement>('.H_imprint');
          if (!outer || !imprint) return;
          // Drop any stale imprint left in the outer container by a previous
          // map instance (e.g. after a design change re-init) before moving the
          // current one, so attribution never stacks up.
          outer.querySelectorAll(':scope > .H_imprint').forEach((el) => {
            if (el !== imprint) el.remove();
          });
          if (imprint.parentElement !== outer) outer.appendChild(imprint);
        };
        moveImprint();
        requestAnimationFrame(moveImprint);

        ctrl.setCameraMoveStartListener((camera: MapCameraPosition) => {
          setVisualTilt(camera.tilt);
          setVisualBearing(camera.bearing);
          state.updateCameraPosition(camera);
          onCameraMoveStartRef.current?.(camera);
        });
        ctrl.setCameraMoveListener((camera: MapCameraPosition) => {
          setVisualTilt(camera.tilt);
          setVisualBearing(camera.bearing);
          state.updateCameraPosition(camera);
          onCameraMoveRef.current?.(camera);
          setCameraTick((t) => t + 1);
        });
        ctrl.setCameraMoveEndListener((camera: MapCameraPosition) => {
          setVisualTilt(camera.tilt);
          setVisualBearing(camera.bearing);
          state.updateCameraPosition(camera);
          onCameraMoveEndRef.current?.(camera);
          setCameraTick((t) => t + 1);
        });
        ctrl.setMapClickListener((point: GeoPoint) => onMapClickRef.current?.(point));
        ctrl.setMapLongClickListener((point: GeoPoint) => onMapLongClickRef.current?.(point));
        ctrl.setMapInitializedListener(() => {
          // 地図が出来た時点の実カメラ（visibleRegion 込み）を state へ流し込む。
          // これで `mapViewState.cameraPosition` が最初から権威ある値になり、
          // 拡張モジュールが `cameraPosition.visibleRegion.bounds` を初回から読める。
          const initial = typedControllerRef.current?.getCameraPosition() ?? null;
          if (initial) state.updateCameraPosition(initial);
          setIsLoaded(true);
          onMapLoadedRef.current?.(state);
        });

        const registry = scope.buildRegistry();
        for (const overlay of registry.getAll()) {
          bridgeUnsubs.current.push(
            overlay.subscribe((data) => {
              overlay.render(data, ctrl).catch((err) => console.error('[HereMapView2D] overlay render failed', err));
            }),
          );
        }

        bridgeUnsubs.current.push(
          scope.bubbleCollector.subscribe((entries) => {
            setBubbleEntries(Array.from(entries.values()));
          }),
        );

        // Track marker states so the billboard overlay can draw upright icons
        // at each marker's projected screen position while the view is tilted.
        bridgeUnsubs.current.push(
          scope.markerCollector.subscribe((states) => {
            setMarkerStates(Array.from(states.values()));
          }),
        );

        ctrl.setMarkerAnimationOverlayHost(scope.markerAnimationStore.start as never);
        bridgeUnsubs.current.push(() => ctrl.setMarkerAnimationOverlayHost(null as never));
        bridgeUnsubs.current.push(scope.markerAnimationStore.subscribe(setAnimationEntries));

        const capable = ctrl as unknown as Record<string, (next: never) => unknown>;
        const setupUpdateHandler = <S extends { id: string }>(
          collector: OverlayCollector<S>,
          hasMethod: string,
          updateMethod: string,
          onUpdated?: () => void,
        ) => {
          collector.setUpdateHandler((nextState) => {
            if ((capable[hasMethod] as ((value: S) => boolean) | undefined)?.(nextState)) {
              void (capable[updateMethod] as (value: S) => Promise<void> | undefined)?.(nextState);
              onUpdated?.();
            }
          });
          bridgeUnsubs.current.push(() => collector.setUpdateHandler(null));
        };

        setupUpdateHandler(scope.markerCollector, 'hasMarker', 'updateMarker', () => {
          setCameraTick((t) => t + 1);
        });
        setupUpdateHandler(scope.circleCollector, 'hasCircle', 'updateCircle');
        setupUpdateHandler(scope.polylineCollector, 'hasPolyline', 'updatePolyline');
        setupUpdateHandler(scope.polygonCollector, 'hasPolygon', 'updatePolygon');
        setupUpdateHandler(scope.groundImageCollector, 'hasGroundImage', 'updateGroundImage');
        setupUpdateHandler(scope.rasterLayerCollector, 'hasRasterLayer', 'updateRasterLayer');

        // Apply the current design (in case the controller was created with
        // the default and the user passed a different one).
        ctrl.setMapDesignType(state.mapDesignType);

        setIsReady(true);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        const error = reason instanceof Error ? reason : new Error(String(reason));
        console.error('[HereMapView2D] Failed to initialize HERE map:', error);
        onErrorRef.current?.(error);
      });

    return () => {
      cancelled = true;
      state.setCameraPositionChangeListener(null);
      state.setController(null);
      typedControllerRef.current = null;
      bridgeUnsubs.current.forEach((unsubscribe) => unsubscribe());
      bridgeUnsubs.current = [];
      provider.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mapDesignType.id, minZoom, maxZoom, restrictBounds]);

  useMapUISettings(state, controller);
  // マップ生成時 config だけでなく、prop の変化にも追随させる（android-sdk 相当）。
  useCameraRestriction(controller, { cameraRestriction, restrictBounds, minZoom, maxZoom });


  // マーカー描画 capability をこのマップのサービスレジストリへ登録する。
  // marker-clustering などの拡張がここから解決する
  // （android-sdk の *MapView.kt / ios-sdk の *MapView.swift が
  //  MarkerRenderingSupportKey を put するのと同じ位置づけ）。
  useMarkerRenderingSupport(state, scope, controller);

  return (
    <MapContext.Provider value={{ controller, isReady, isLoaded, state }}>
      <div
        ref={outerContainerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          ...containerStyle,
        }}
      >
        <div
          ref={containerRef}
          className={className}
          style={mapPlaneStyle}
        />
        <MapAttributionOverlay
          scope={scope}
          camera={state.cameraPosition}
          designAttributionRules={state.mapDesignType.attributionRules}
        />
        {controller && <HereTiltMarkerCanvas controller={controller} active={isTilted} />}
        {animationEntries.length > 0 && typedControllerRef.current && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 650, pointerEvents: 'none' }}>
            <MarkerAnimationLayer
              entries={animationEntries}
              resolveScreenOffset={(entry) =>
                typedControllerRef.current!.holder.toScreenOffset(entry.state.position)
              }
            />
          </div>
        )}
        {bubbleEntries.length > 0 && typedControllerRef.current && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 750, pointerEvents: 'none', overflow: 'hidden' }}>
            {bubbleEntries.map((entry) => {
              const holder = typedControllerRef.current!.holder;
              const pos = entry.positionProvider();
              const screenOffset = holder.toScreenOffset(pos);
              const icon = entry.icon;
              const iconPixelSize = icon ? icon.iconSize * icon.scale : 0;
              return (
                <InfoBubbleOverlay
                  key={entry.id}
                  positionOffset={screenOffset}
                  iconSize={{ width: iconPixelSize, height: iconPixelSize }}
                  iconOffset={icon ? icon.anchor : { x: 0.5, y: 0.5 }}
                  infoAnchorOffset={icon ? icon.infoAnchor : { x: 0.5, y: 0.5 }}
                  tailOffset={entry.tailOffset}
                  style={{ pointerEvents: 'auto' }}
                >
                  {entry.content as ReactNode}
                </InfoBubbleOverlay>
              );
            })}
          </div>
        )}
      </div>
      <MapServiceRegistryProvider registry={state.serviceRegistry}>
        <MapViewScopeProvider scope={scope}>{children}</MapViewScopeProvider>
      </MapServiceRegistryProvider>
    </MapContext.Provider>
  );
}
