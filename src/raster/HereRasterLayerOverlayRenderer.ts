/**
 * Port of `HereRasterLayerOverlayRenderer.kt` in
 * `android-for-here/.../raster/HereRasterLayerOverlayRenderer.kt`.
 *
 * Uses the HERE Maps API for JavaScript tile layer stack
 * (`H.map.layer.TileLayer` + `H.map.provider.ImageTileProvider`) instead of
 * `RasterDataSource` + `MapLayerBuilder`.
 *
 * First version supports the `UrlTemplate` and `ArcGisService` source variants
 * (TMS/XYZ). The Android opacity proxy (`HereRasterTileProxyProvider`) is
 * omitted in the basic version; opacity is forwarded directly to the layer.
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
        if (
          prev.fingerPrint.source !== p.current.fingerPrint.source ||
          prev.state.opacity !== next.opacity
        ) {
          await this.removeLayer(prev);
          return await this.addLayer(next);
        }
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

    const provider = createUrlTileProvider(spec);
    if (!provider) return null;

    const tileLayer = new H.map.layer.TileLayer(provider, { opacity: state.opacity });
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

function createUrlTileProvider(spec: TileSpec): H.map.Provider | null {
  const ImageTileProviderCtor = (H.map as any).provider?.ImageTileProvider;
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
      getURL: buildUrl,
    });
    return provider as H.map.Provider;
  } catch {
    return null;
  }
}
