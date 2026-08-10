import { AbstractZoomAltitudeConverter, WebMercatorZoomAltitudeConverter } from '@mapconductor/js-sdk-core';

/**
 * 統一ズーム（Google Maps 基準・256px タイル）⇄ 高度の変換。
 *
 * HERE Maps API for JavaScript は平坦な Web Mercator で描き、ズームの取り方が
 * どの緯度でも Google / MapLibre と同じなので、here⇄google のズーム変換は恒等。
 * つまりオフセットは 0。`cos(latitude)` はズームを実距離（メートル）へ直すときだけ効く。
 *
 * **ネイティブの HERE SDK とは違う。** android-for-here / ios-for-here は距離基準の
 * カメラで緯度補正が要り、しかも緯度・tilt のクランプが無いのでコアの実装に寄せていない。
 * web だけがこの形。
 *
 * 換算式はコアの {@link WebMercatorZoomAltitudeConverter} にある。
 */
export class ZoomAltitudeConverter extends WebMercatorZoomAltitudeConverter {
    static readonly HERE_ZOOM_TO_GOOGLE_ZOOM_AT_EQUATOR = 0.0;

    constructor(zoom0Altitude: number = AbstractZoomAltitudeConverter.DEFAULT_ZOOM0_ALTITUDE) {
        super(zoom0Altitude, ZoomAltitudeConverter.HERE_ZOOM_TO_GOOGLE_ZOOM_AT_EQUATOR);
    }

    static hereZoomToGoogleZoom(hereZoom: number, _latitude: number): number {
        const googleZoom = hereZoom + ZoomAltitudeConverter.HERE_ZOOM_TO_GOOGLE_ZOOM_AT_EQUATOR;
        return Math.min(
            Math.max(googleZoom, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL),
            AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL,
        );
    }

    static googleZoomToHereZoom(googleZoom: number, _latitude: number): number {
        const hereZoom = googleZoom - ZoomAltitudeConverter.HERE_ZOOM_TO_GOOGLE_ZOOM_AT_EQUATOR;
        return Math.min(
            Math.max(hereZoom, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL),
            AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL,
        );
    }
}
