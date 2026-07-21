/**
 * Port of `ZoomAltitudeConverter.kt` in
 * `android-for-here/.../zoom/ZoomAltitudeConverter.kt`.
 *
 * Unlike the Android HERE SDK (whose camera is distance-based and needs a
 * latitude correction), the HERE Maps API for JavaScript renders a flat
 * WebMercator view whose zoom convention is identical to Google/MapLibre at
 * every latitude, so here<->google zoom conversion is the identity. The
 * cos(latitude) factor only applies when converting zoom to real-world
 * altitude (meters), same as Google's own zoom/altitude relation.
 */
import { AbstractZoomAltitudeConverter } from '@mapconductor/js-sdk-core';

export class ZoomAltitudeConverter extends AbstractZoomAltitudeConverter {
  static readonly HERE_ZOOM_TO_GOOGLE_ZOOM_AT_EQUATOR = 0.0;

  private static cosLatitudeFactor(latitudeDeg: number): number {
    const clamped = Math.max(-85, Math.min(85, latitudeDeg));
    const latRad = (clamped * Math.PI) / 180;
    return Math.max(AbstractZoomAltitudeConverter.MIN_COS_LAT, Math.abs(Math.cos(latRad)));
  }

  static hereZoomToGoogleZoom(hereZoom: number, _latitude: number): number {
    const googleZoom =
      hereZoom + ZoomAltitudeConverter.HERE_ZOOM_TO_GOOGLE_ZOOM_AT_EQUATOR;
    return Math.min(
      Math.max(googleZoom, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL),
      AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL,
    );
  }

  static googleZoomToHereZoom(googleZoom: number, _latitude: number): number {
    const hereZoom =
      googleZoom - ZoomAltitudeConverter.HERE_ZOOM_TO_GOOGLE_ZOOM_AT_EQUATOR;
    return Math.min(
      Math.max(hereZoom, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL),
      AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL,
    );
  }

  zoomLevelToAltitude({
    zoomLevel,
    latitude,
    tilt,
  }: {
    zoomLevel: number;
    latitude: number;
    tilt: number;
  }): number {
    const clampedZoom = Math.min(
      Math.max(zoomLevel, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL),
      AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL,
    );
    const cosLat = ZoomAltitudeConverter.cosLatitudeFactor(latitude);
    const tiltRad = (Math.max(0, Math.min(90, tilt)) * Math.PI) / 180;
    const cosTilt = Math.max(
      AbstractZoomAltitudeConverter.MIN_COS_TILT,
      Math.cos(tiltRad),
    );
    const distance =
      (this.zoom0Altitude * cosLat) /
      Math.pow(AbstractZoomAltitudeConverter.ZOOM_FACTOR, clampedZoom);
    const altitude = distance * cosTilt;
    return Math.min(
      Math.max(altitude, AbstractZoomAltitudeConverter.MIN_ALTITUDE),
      AbstractZoomAltitudeConverter.MAX_ALTITUDE,
    );
  }

  altitudeToZoomLevel({
    altitude,
    latitude,
    tilt,
  }: {
    altitude: number;
    latitude: number;
    tilt: number;
  }): number {
    const clampedAltitude = Math.min(
      Math.max(altitude, AbstractZoomAltitudeConverter.MIN_ALTITUDE),
      AbstractZoomAltitudeConverter.MAX_ALTITUDE,
    );
    const cosLat = ZoomAltitudeConverter.cosLatitudeFactor(latitude);
    const tiltRad = (Math.max(0, Math.min(90, tilt)) * Math.PI) / 180;
    const cosTilt = Math.max(
      AbstractZoomAltitudeConverter.MIN_COS_TILT,
      Math.cos(tiltRad),
    );
    const distance = clampedAltitude / cosTilt;
    const zoomLevel = Math.log2((this.zoom0Altitude * cosLat) / distance);
    return Math.min(
      Math.max(zoomLevel, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL),
      AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL,
    );
  }
}
