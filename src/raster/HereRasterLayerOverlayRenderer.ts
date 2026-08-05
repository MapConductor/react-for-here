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
import {
  TileScheme,
  type MapCameraPosition,
  type RasterLayerChangeParams,
  type RasterLayerAddParams,
  type RasterLayerEntity,
  type RasterLayerOverlayRenderer,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import type { HereRasterLayerHandle } from './HereRasterLayerHandle';
import type { HereViewHolder } from '../HereViewHolder';

interface TileSpec {
  readonly urlTemplate: string;
  readonly tileSize: number;
  readonly minZoom: number | null;
  readonly maxZoom: number | null;
  readonly tms: boolean;
}

export type ActualRasterLayer = HereRasterLayerHandle & object;

export class HereRasterLayerOverlayRenderer
  implements RasterLayerOverlayRenderer<ActualRasterLayer>
{
  constructor(private readonly holder: HereViewHolder) {}

  async onAdd(
    data: RasterLayerAddParams[],
  ): Promise<(ActualRasterLayer | null)[]> {
    return Promise.all(data.map((p) => this.addLayer(p.state)));
  }

  async onChange(
    data: RasterLayerChangeParams<ActualRasterLayer>[],
  ): Promise<(ActualRasterLayer | null)[]> {
    return Promise.all(
      data.map(async (p) => {
        const prev = p.prev;
        const next = p.current.state;
        if (prev.fingerPrint.source !== p.current.fingerPrint.source) {
          await this.removeLayer(prev);
          return await this.addLayer(next);
        }
        // Opacity and visibility are updated in place (opacity via the
        // provider's setOpacity) so the slider doesn't reload every tile.
        this.updateLayer(prev.layer, next);
        return prev.layer;
      }),
    );
  }

  async onRemove(data: RasterLayerEntity<ActualRasterLayer>[]): Promise<void> {
    for (const entity of data) {
      await this.removeLayer(entity);
    }
  }

  async onCameraChanged(_mapCameraPosition: MapCameraPosition): Promise<void> {}

  async onPostProcess(): Promise<void> {}

  private addLayer(state: RasterLayerState): ActualRasterLayer | null {
    const spec = resolveTileSpec(state);
    if (!spec) return null;

    const provider = createUrlTileProvider(spec, state.opacity);
    if (!provider) return null;

    // Opacity is carried by the provider (see file header); the TileLayer takes
    // no opacity option.
    const tileLayer = new H.map.layer.TileLayer(provider);
    const attached = state.visible !== false;
    if (attached) {
      this.holder.map.addLayer(tileLayer);
    }

    return {
      layer: tileLayer,
      attached,
      sourceName: `raster-source-${state.id}`,
      layerName: `raster-layer-${state.id}`,
      routeId: null,
    };
  }

  private updateLayer(handle: ActualRasterLayer, state: RasterLayerState): void {
    // Opacity lives on the provider; setOpacity invalidates the tiles so the
    // map re-renders at the new opacity without recreating the layer.
    const provider = handle.layer.getProvider() as Partial<HereOpacityProvider>;
    if (typeof provider.setOpacity === 'function') {
      provider.setOpacity(clampOpacity(state.opacity));
    }

    const shouldAttach = state.visible !== false;
    if (shouldAttach === handle.attached) return;
    if (shouldAttach) {
      this.holder.map.addLayer(handle.layer);
    } else {
      this.holder.map.removeLayer(handle.layer);
    }
    handle.attached = shouldAttach;
  }

  private async removeLayer(
    entity: RasterLayerEntity<ActualRasterLayer>,
  ): Promise<void> {
    if (entity.layer.attached) {
      this.holder.map.removeLayer(entity.layer.layer);
      entity.layer.attached = false;
    }
  }
}

function resolveTileSpec(state: RasterLayerState): TileSpec | null {
  const source = state.source;
  switch (source.type) {
    case 'UrlTemplate':
      return {
        urlTemplate: source.template,
        tileSize: source.tileSize ?? 256,
        minZoom: source.minZoom ?? null,
        maxZoom: source.maxZoom ?? null,
        tms: source.scheme === TileScheme.TMS,
      };
    case 'ArcGisService': {
      const base = source.serviceUrl.replace(/\/+$/, '');
      return {
        urlTemplate: `${base}/tile/{z}/{y}/{x}`,
        tileSize: 256,
        minZoom: null,
        maxZoom: null,
        tms: false,
      };
    }
    case 'TileJson':
      // TileJSON would require a network round-trip; skip in the basic version.
      return null;
  }
}

// `H.map.provider.ImageTileProvider` is part of the HERE Maps API but is not
// declared in this package's intentionally-minimal ambient typings (here.d.ts),
// so reach it through a narrowly-typed structural cast instead of `any`. In the
// HERE JS API opacity is a provider capability (`opacity` option + setOpacity()).
type HereOpacityProvider = H.map.Provider & { setOpacity(opacity: number): void };
type ImageTileProviderConstructor = new (options: {
  tileSize: number;
  min?: number;
  max?: number;
  opacity?: number;
  getURL: (x: number, y: number, z: number) => string;
}) => HereOpacityProvider;

function clampOpacity(opacity: number): number {
  if (!Number.isFinite(opacity)) return 1;
  return Math.min(1, Math.max(0, opacity));
}

function createUrlTileProvider(spec: TileSpec, opacity: number): H.map.Provider | null {
  const ImageTileProviderCtor = (
    H.map as unknown as { provider?: { ImageTileProvider?: ImageTileProviderConstructor } }
  ).provider?.ImageTileProvider;
  if (typeof ImageTileProviderCtor !== 'function') return null;

  const buildUrl = (x: number, y: number, z: number) => {
    const scale = 1 << z;
    const wrappedX = ((x % scale) + scale) % scale;
    const finalY = spec.tms ? scale - 1 - y : y;
    return spec.urlTemplate
      .replace('{z}', String(z))
      .replace('{x}', String(wrappedX))
      .replace('{y}', String(finalY));
  };

  try {
    // `getURL` must be a property of the single options object — HERE's real
    // `ImageTileProvider` constructor takes one argument, not
    // `(options, getUrl)`. Passing the URL builder positionally (as this
    // used to) means `getURL` is silently missing from the options, so the
    // provider can never build a tile URL and no raster tiles ever render.
    const provider = new ImageTileProviderCtor({
      tileSize: spec.tileSize,
      min: spec.minZoom ?? undefined,
      max: spec.maxZoom ?? undefined,
      opacity: clampOpacity(opacity),
      getURL: buildUrl,
    });
    return provider as H.map.Provider;
  } catch {
    return null;
  }
}
