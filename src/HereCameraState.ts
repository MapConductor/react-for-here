import { createGeoPoint, MapPaddings, paddedCameraCenter, paddedCameraTarget } from '@mapconductor/js-sdk-core';
import { toGeoPoint } from './GeoPoint';
import { mapCameraPositionFrom, toHereLookAtData } from './MapCameraPosition';
import type { GeoPoint, MapCameraPosition } from '@mapconductor/js-sdk-core';
import type { HereViewHolder } from './HereViewHolder';
import type { HereCameraConstraints } from './HereCameraConstraints';
import { readVisibleRegion } from './HereVisibleRegion';

/**
 * HERE JS の 2D 地図は傾けられないので、平面を CSS で潰して tilt を見せている。
 * 遠近は無いので上下視野角は 0。
 */
const HERE_VERTICAL_FOV_DEGREES = 0;

/** カメラが止まったとみなすまでの無操作時間。HERE JS に移動終了の通知が無いため。 */
const CAMERA_MOVE_END_IDLE_MS = 120;

/**
 * 論理カメラの保持と、HERE からのカメラ変化の解釈。
 *
 * HERE の `getLookAtData()` は tilt を負にできない（上向き視点を持てない）ので、
 * MapConductor 側の**論理値**をここで別に覚えておき、読み出しのときに混ぜる。
 * また HERE JS には「動き始めた」「動き終わった」の通知が無いため、
 * 連続変化の最初を移動開始、無操作 [CAMERA_MOVE_END_IDLE_MS] を移動終了として
 * ここで合成している。
 */
export interface CameraDeps {
  readonly holder: HereViewHolder;
  readonly constraints: HereCameraConstraints;
  onCameraMoveStart(camera: MapCameraPosition): void;
  onCameraMove(camera: MapCameraPosition): void;
  onCameraMoveEnd(camera: MapCameraPosition): void;
  /** 移動が落ち着いたときに、各オーバーレイへカメラを配る。 */
  onCameraSettled(camera: MapCameraPosition): Promise<void>;
}

export class HereCameraState {
  private logicalTilt = 0;
  private logicalPosition: GeoPoint = createGeoPoint({ latitude: 0, longitude: 0 });
  private logicalZoom = 0;
  private logicalBearing = 0;
  private isAnimating = false;
  private moveInProgress = false;
  private moveEndTimer: ReturnType<typeof setTimeout> | null = null;
  private lastReported: MapCameraPosition | null = null;
  /**
   * 最後に動かしたときの `MapCameraPosition.paddings`。HERE の tilt は CSS で平面を
   * 潰して見せているので、ViewPort のパディングではなく中心をずらして再現する。
   */
  private cameraPaddings: MapPaddings | null = null;

  constructor(private readonly deps: CameraDeps) {}

  /** 地図の初期 lookAt を論理カメラの初期値として取り込む。 */
  seed(lookAt: H.map.ViewLookAtData): void {
    this.logicalPosition = toGeoPoint(lookAt.position);
    if (lookAt.zoom !== undefined) this.logicalZoom = lookAt.zoom;
  }

  get visualTilt(): number {
    return Math.min(60, Math.abs(this.logicalTilt));
  }

  get visualBearing(): number {
    return this.logicalBearing;
  }

  dispose(): void {
    if (this.moveEndTimer != null) clearTimeout(this.moveEndTimer);
    this.moveEndTimer = null;
  }

  /**
   * Shared camera commit for moveCamera/animateCamera/fitBounds.
   *
   * `snapZoom` defaults to true so explicit camera targets quantize their zoom
   * to match the Google Maps 2D reference (see `snapZoomToGoogle`). fitBounds
   * passes false to keep its computed fractional zoom, so the bounds actually
   * fit the padded viewport.
   */
  apply(
    position: MapCameraPosition,
    { animated, snapZoom = true }: { animated: boolean; snapZoom?: boolean },
  ): Promise<boolean> {
    this.setLogical(position);
    const sent = this.withPaddedCenter(position, snapZoom ? Math.round(position.zoom) : position.zoom);
    const lookAt = this.deps.constraints.constrain(toHereLookAtData(sent, { snapZoom }));
    if (!animated) {
      this.deps.holder.map.getViewModel().setLookAtData(lookAt, false);
      return Promise.resolve(true);
    }
    this.isAnimating = true;
    this.deps.holder.map.getViewModel().setLookAtData(lookAt, true);
    // HERE JS does not expose an animation-end callback on setLookAtData
    // directly. Recover via the next mapviewchangeend event.
    const map = this.deps.holder.map;
    const handler = () => {
      map.removeEventListener('mapviewchangeend', handler as never);
      this.isAnimating = false;
      const camera = this.read();
      if (camera) this.deps.onCameraMoveEnd(camera);
    };
    map.addEventListener('mapviewchangeend', handler as never);
    return Promise.resolve(true);
  }

  read(): MapCameraPosition | null {
    const lookAt = this.deps.holder.map.getViewModel().getLookAtData();
    const usesNegativeTiltOffset = this.logicalTilt < 0;
    const zoom = usesNegativeTiltOffset ? this.logicalZoom : lookAt.zoom;
    const live = toGeoPoint(lookAt.position);
    const logical = mapCameraPositionFrom({
      position: usesNegativeTiltOffset
        ? this.logicalPosition
        : this.cameraPaddings && zoom !== undefined
          ? paddedCameraTarget(live, this.paddingParams(this.cameraPaddings, zoom))
          : live,
      zoom,
      bearing: this.logicalBearing,
      tilt: this.logicalTilt,
    }).copy({ paddings: this.cameraPaddings ?? MapPaddings.Zeros, fov: HERE_VERTICAL_FOV_DEGREES });
    const visibleRegion = readVisibleRegion(this.deps.holder);
    return visibleRegion ? logical.copy({ visibleRegion }) : logical;
  }

  /**
   * パディングを除いた領域の中央に target が来るよう、lookAt の中心をずらす。
   * 傾きは CSS で平面を潰しているだけ（遠近なし）なので fov 0 で計算する。
   */
  private withPaddedCenter(position: MapCameraPosition, zoom: number): MapCameraPosition {
    const paddings = position.paddings ?? this.cameraPaddings;
    this.cameraPaddings = paddings;
    if (!paddings) return position;
    return position.copy({ position: paddedCameraCenter(position.position, this.paddingParams(paddings, zoom)) });
  }

  private paddingParams(paddings: MapPaddings, zoom: number) {
    const viewport = this.deps.holder.mapView.parentElement;
    return {
      zoom,
      tilt: this.visualTilt,
      bearing: this.visualBearing,
      paddings,
      fov: HERE_VERTICAL_FOV_DEGREES,
      viewport: { width: viewport?.clientWidth ?? 0, height: viewport?.clientHeight ?? 0 },
    };
  }

  private setLogical(position: MapCameraPosition): void {
    this.logicalTilt = position.tilt;
    this.logicalPosition = position.position;
    this.logicalZoom = position.zoom;
    this.logicalBearing = position.bearing;
  }

  onChange(): void {
    if (this.deps.constraints.enforce()) return;
    const camera = this.read();
    if (!camera) return;
    this.lastReported = camera;
    if (this.isAnimating) return;

    // Synthesize "move start" on the first continuous change after an idle
    // period (HERE JS has no dedicated mapviewchangestart event).
    if (!this.moveInProgress) {
      this.moveInProgress = true;
      this.deps.onCameraMoveStart(camera);
    }
    this.deps.onCameraMove(camera);
  }

  onChangeEnd(): void {
    if (this.deps.constraints.enforce()) return;
    if (this.isAnimating) return;
    if (this.moveEndTimer != null) clearTimeout(this.moveEndTimer);
    this.moveEndTimer = setTimeout(() => {
      this.moveEndTimer = null;
      const camera = this.lastReported ?? this.read();
      if (!camera) return;
      this.moveInProgress = false;
      void this.deps.onCameraSettled(camera);
      this.deps.onCameraMoveEnd(camera);
    }, CAMERA_MOVE_END_IDLE_MS);
  }
}
