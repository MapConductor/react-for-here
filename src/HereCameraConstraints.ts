import type { GeoRectBounds, VisibleRegion } from '@mapconductor/js-sdk-core';
import { toGeoRect } from './GeoRectBounds';

/**
 * カメラ範囲・ズーム制限のクランプ。
 *
 * HERE JS API にはカメラ範囲制限の API が無いため、`setLookAtData` の直前と
 * 「動いた後」の両方で自前にクランプして実現している。カメラ中心だけでなく
 * **可視領域全体**を矩形内に収めるので、android-sdk のクランプより厳格。
 *
 * 制限そのもの（[bounds] / [minZoom] / [maxZoom]）と補正の再入を防ぐフレーム
 * 予約をここが持ち、地図と可視領域の読み取りだけを [ConstraintDeps] で受け取る。
 */
export interface ConstraintDeps {
  readonly map: H.Map;
  /** 現在の可視領域。取れないときは null。 */
  getVisibleRegion(): VisibleRegion | null;
}

export class HereCameraConstraints {
  private bounds?: GeoRectBounds;
  private minZoom?: number;
  private maxZoom?: number;
  private frame: number | null = null;

  constructor(
    private readonly deps: ConstraintDeps,
    initial?: { bounds?: GeoRectBounds; minZoom?: number; maxZoom?: number },
  ) {
    this.bounds = initial?.bounds;
    this.minZoom = initial?.minZoom;
    this.maxZoom = initial?.maxZoom;
  }

  set(restriction: { bounds?: GeoRectBounds; minZoom?: number; maxZoom?: number } | null): void {
    this.bounds = restriction?.bounds ?? undefined;
    this.minZoom = restriction?.minZoom ?? undefined;
    this.maxZoom = restriction?.maxZoom ?? undefined;
  }

  /** `setLookAtData` へ渡す直前に、ズームと中心を制限内へ丸める。 */
  constrain(data: H.map.ViewLookAtData): H.map.ViewLookAtData {
    const bounds = this.bounds;
    const position = data.position;
    return {
      ...data,
      ...(data.zoom !== undefined ? { zoom: clamp(data.zoom, this.minZoom, this.maxZoom) } : {}),
      ...(position && bounds?.southWest && bounds.northEast
        ? {
            position: {
              ...position,
              lat: clamp(position.lat, bounds.southWest.latitude, bounds.northEast.latitude),
              lng: clamp(position.lng, bounds.southWest.longitude, bounds.northEast.longitude),
            },
          }
        : {}),
    };
  }

  /** カメラ中心と可視領域の両方を制限内へ収める。補正したら true。 */
  enforce(): boolean {
    const map = this.deps.map;
    const lookAt = map.getViewModel().getLookAtData();
    const constrained = this.constrain(lookAt);
    if (
      constrained.zoom !== lookAt.zoom ||
      constrained.position?.lat !== lookAt.position.lat ||
      constrained.position?.lng !== lookAt.position.lng
    ) {
      map.getViewModel().setLookAtData(constrained, false);
      this.schedule();
      return true;
    }

    const restrict = this.bounds;
    const visible = this.deps.getVisibleRegion()?.bounds;
    if (!restrict?.southWest || !restrict.northEast || !visible?.southWest || !visible.northEast) {
      return false;
    }

    const visibleLatSpan = visible.northEast.latitude - visible.southWest.latitude;
    const visibleLngSpan = visible.northEast.longitude - visible.southWest.longitude;
    const restrictLatSpan = restrict.northEast.latitude - restrict.southWest.latitude;
    const restrictLngSpan = restrict.northEast.longitude - restrict.southWest.longitude;
    if (visibleLatSpan > restrictLatSpan || visibleLngSpan > restrictLngSpan) {
      const rect = toGeoRect(restrict);
      if (rect) map.getViewModel().setLookAtData({ bounds: rect }, false);
      return rect != null;
    }

    const center = lookAt.position;
    const minLat = restrict.southWest.latitude + (center.lat - visible.southWest.latitude);
    const maxLat = restrict.northEast.latitude - (visible.northEast.latitude - center.lat);
    const minLng = restrict.southWest.longitude + (center.lng - visible.southWest.longitude);
    const maxLng = restrict.northEast.longitude - (visible.northEast.longitude - center.lng);
    const nextLat = clamp(center.lat, minLat, maxLat);
    const nextLng = clamp(center.lng, minLng, maxLng);
    if (Math.abs(nextLat - center.lat) < 1e-9 && Math.abs(nextLng - center.lng) < 1e-9) {
      return false;
    }
    map.getViewModel().setLookAtData(
      { ...lookAt, position: { ...center, lat: nextLat, lng: nextLng } },
      false,
    );
    return true;
  }

  /**
   * 次フレームでもう一度 [enforce] する。
   *
   * `setLookAtData` の反映は即時ではないため、1 回のクランプで収まりきらない
   * ことがある。予約は 1 本だけ持ち、重ねて呼ばれたら前の予約を捨てる。
   */
  schedule(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.enforce();
    });
  }

  dispose(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}

function clamp(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}
