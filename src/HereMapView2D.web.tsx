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
  MapViewScopeProvider,
  MarkerAnimationLayer,
  MapAttributionOverlay,
  type InfoBubbleEntry,
} from '@mapconductor/js-sdk-react';
import {
  type GeoPoint,
  type GeoRectBounds,
  type MapCameraPosition,
  type MapViewBaseProps,
  type MarkerAnimationOverlayEntry,
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
  pixelRatio,
  platform,
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
  const typedControllerRef = useRef<HereMapViewController | null>(null);
  const bridgeUnsubs = useRef<(() => void)[]>([]);
  const [bubbleEntries, setBubbleEntries] = useState<InfoBubbleEntry[]>([]);
  const [animationEntries, setAnimationEntries] = useState<MarkerAnimationOverlayEntry[]>([]);
  const [, setCameraTick] = useState(0);
  const [visualTilt, setVisualTilt] = useState(() => state.cameraPosition.tilt);
  const [visualBearing, setVisualBearing] = useState(() => state.cameraPosition.bearing);
  const experimentalTilt = Math.min(60, Math.abs(visualTilt));
  const mapPlaneStyle: CSSProperties = {
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

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    setIsReady(false);

    const config: HereConfig = {
      container: containerRef.current,
      initCameraPosition: state.cameraPosition,
      mapDesignType: state.mapDesignType,
      minZoom,
      maxZoom,
      restrictBounds,
      pixelRatio,
      platform,
    };

    provider
      .initialize(config)
      .then((rawController) => {
        if (cancelled) return;
        const ctrl = rawController as HereMapViewController;
        typedControllerRef.current = ctrl;
        state.setController(ctrl);
        state.setCameraPositionChangeListener((camera) => {
          setVisualTilt(camera.tilt);
          setVisualBearing(camera.bearing);
          setCameraTick((t) => t + 1);
        });
        setController(ctrl);

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
        ctrl.setMapInitializedListener(() => onMapLoadedRef.current?.(state));

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

  return (
    <MapContext.Provider value={{ controller, isReady }}>
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
          camera={typedControllerRef.current?.getCameraPosition() ?? state.cameraPosition}
          designAttributionRules={state.mapDesignType.attributionRules}
        />
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
      <MapViewScopeProvider scope={scope}>{children}</MapViewScopeProvider>
    </MapContext.Provider>
  );
}
