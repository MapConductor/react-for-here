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
import type { BitmapIcon } from '@mapconductor/js-sdk-core';

export function toMapImage(bitmapIcon: BitmapIcon): Promise<H.map.Icon> {
  return loadImageElement(bitmapIcon.url).then((image) => {
    return new H.map.Icon(image, {
      size: { w: bitmapIcon.size.width, h: bitmapIcon.size.height },
      anchor: new H.math.Point(
        bitmapIcon.anchor.x * bitmapIcon.size.width,
        bitmapIcon.anchor.y * bitmapIcon.size.height,
      ),
    });
  });
}

export function toAnchor2D(bitmapIcon: BitmapIcon): H.math.Point<number> {
  return new H.math.Point(
    bitmapIcon.anchor.x * bitmapIcon.size.width,
    bitmapIcon.anchor.y * bitmapIcon.size.height,
  );
}

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load icon: ${url}`));
    image.src = url;
  });
}
