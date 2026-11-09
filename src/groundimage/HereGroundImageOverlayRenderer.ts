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
import {
  AbstractGroundImageOverlayRenderer,
  type GroundImageEntity,
  type GroundImageState,
} from '@mapconductor/js-sdk-core';
import type { HereActualGroundImage } from '../HereTypeAlias';
import type { HereGroundImageHandle } from './HereGroundImageHandle';
import { HereViewHolder } from '../HereViewHolder';
import { toGeoRect } from '../GeoRectBounds';
import { addStackedLayer } from '../helpers';

export class HereGroundImageOverlayRenderer extends AbstractGroundImageOverlayRenderer<
  HereViewHolder,
  HereActualGroundImage
> {
  private provider: H.map.provider.LocalObjectProvider | null = null;

  /**
   * Ground images live in an ObjectLayer of their own, in map.getLayers() above the rasters.
   * In the map's own object layer an `H.map.Overlay` is drawn over the polygons, circles and
   * polylines whatever its zIndex (it was given -100,000,000 and still covered them).
   */
  private objects(): ReturnType<H.map.provider.LocalObjectProvider['getRootGroup']> {
    if (this.provider == null) {
      this.provider = new H.map.provider.LocalObjectProvider();
      addStackedLayer(this.holder.map, new H.map.layer.ObjectLayer(this.provider), 'groundImage');
    }
    return this.provider.getRootGroup();
  }

  override async createGroundImage(
    state: GroundImageState,
  ): Promise<HereActualGroundImage | null> {
    const rect = toGeoRect(state.bounds);
    if (!rect) return null;

    const image = await loadImage(state.imageUrl);
    const overlay = new H.map.Overlay(rect, image, {
      opacity: state.opacity,
      data: state.id,
    });
    this.objects().addObject(overlay);

    const handle: HereGroundImageHandle = {
      routeId: `groundimage-${state.id}`,
      generation: 0,
      cacheKey: state.fingerPrint().toString(),
      overlay,
    };
    return handle as HereActualGroundImage;
  }

  override async updateGroundImageProperties({
    groundImage,
    current,
    prev,
  }: {
    groundImage: HereActualGroundImage;
    current: GroundImageEntity<HereActualGroundImage>;
    prev: GroundImageEntity<HereActualGroundImage>;
  }): Promise<HereActualGroundImage | null> {
    const finger = current.fingerPrint;
    const prevFinger = prev.fingerPrint;
    if (
      finger.bounds === prevFinger.bounds &&
      finger.imageUrl === prevFinger.imageUrl &&
      finger.opacity === prevFinger.opacity
    ) {
      return groundImage;
    }

    const handle = groundImage as HereGroundImageHandle;
    const { overlay } = handle;

    if (finger.bounds !== prevFinger.bounds) {
      const rect = toGeoRect(current.state.bounds);
      if (!rect) return null;
      overlay.setBoundingBox(rect);
    }
    if (finger.imageUrl !== prevFinger.imageUrl) {
      overlay.setBitmap(await loadImage(current.state.imageUrl));
    }
    if (finger.opacity !== prevFinger.opacity) {
      overlay.setOpacity(current.state.opacity);
    }

    return {
      ...handle,
      cacheKey: finger.toString(),
    } as HereActualGroundImage;
  }

  override async removeGroundImage(
    entity: GroundImageEntity<HereActualGroundImage>,
  ): Promise<void> {
    if (entity.groundImage) {
      this.objects().removeObject((entity.groundImage as HereGroundImageHandle).overlay);
    }
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ground image: ${url}`));
    image.src = url;
  });
}
