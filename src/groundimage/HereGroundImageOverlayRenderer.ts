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

// HereMarkerRenderer.resolveDrawOrder() draws markers at
// `-lat * 1_000_000 - lng`, which ranges over roughly ±90,000,180 depending
// on position. Staying below that whole range keeps the ground image behind
// every default-positioned marker, so a translucent overlay never dims them.
const GROUND_IMAGE_Z_INDEX = -100_000_000;

export class HereGroundImageOverlayRenderer extends AbstractGroundImageOverlayRenderer<
  HereViewHolder,
  HereActualGroundImage
> {
  override async createGroundImage(
    state: GroundImageState,
  ): Promise<HereActualGroundImage | null> {
    const rect = toGeoRect(state.bounds);
    if (!rect) return null;

    const image = await loadImage(state.imageUrl);
    const overlay = new H.map.Overlay(rect, image, {
      opacity: state.opacity,
      zIndex: GROUND_IMAGE_Z_INDEX,
      data: state.id,
    });
    this.holder.map.addObject(overlay);

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
      this.holder.map.removeObject((entity.groundImage as HereGroundImageHandle).overlay);
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
