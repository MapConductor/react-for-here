/**
 * Port of `MapCameraPosition.kt` in `android-for-here/.../MapCameraPosition.kt`.
 *
 * The HERE Maps API for JavaScript exposes look-at state through
 * `H.Map.getViewModel().getLookAt()` (`{ position, zoom, bearing, tilt }`),
 * so the conversion mirrors the Android helpers `toHereDisplayCamera()` and
 * `toMapCameraUpdate()` but targets the JS ViewModel.
 */
import {
  computeOffset,
  createGeoPoint,
  createMapCameraPosition,
  type MapCameraPosition,
  type MapCameraPositionInterface,
} from '@mapconductor/js-sdk-core';
import { ZoomAltitudeConverter } from './zoom/ZoomAltitudeConverter';
import { toGeoCoordinates } from './GeoPoint';

const converter = new ZoomAltitudeConverter();
const NEGATIVE_TILT_TARGET_DISTANCE_SCALE = 1.83;
const NEGATIVE_TILT_ZOOM_OFFSET_AT_MAX_TILT = -0.9;

/**
 * Quantize a programmatic zoom target to the nearest integer, mirroring how
 * Google Maps 2D (the project-wide camera reference) snaps zoom. HERE renders
 * the true fractional zoom, so without this it sits up to half a level apart
 * from Google at fractional targets (Oahu 9.5 -> 10, Kiribati 4.5 -> 5).
 * Reported zoom (lookAtToMapCameraPosition) stays fractional and faithful.
 */
function snapZoomToGoogle(zoom: number): number {
  return Math.round(zoom);
}

export interface HereDisplayCamera {
  target: MapCameraPosition['position'];
  tiltDeg: number;
  hereZoomLevel: number;
  bearing: number;
}

/**
 * Mirrors `MapCameraPosition.toHereDisplayCamera()` in Android.
 * For positive tilt, returns the camera as-is. For negative tilt (which HERE
 * cannot represent directly), shifts the ground target forward and renders
 * with abs(tilt), exactly like the Android implementation.
 */
export function toHereDisplayCamera(position: MapCameraPosition): HereDisplayCamera {
  if (position.tilt >= 0) {
    return {
      target: createGeoPoint({ latitude: position.position.latitude, longitude: position.position.longitude }),
      tiltDeg: position.tilt,
      hereZoomLevel: ZoomAltitudeConverter.googleZoomToHereZoom(snapZoomToGoogle(position.zoom), position.position.latitude),
      bearing: position.bearing,
    };
  }

  // tilt < 0: HERE cannot represent upward pitch directly.
  // Keep the virtual eye direction by moving the ground target forward and
  // rendering with abs(tilt).
  const tiltAbsDeg = Math.min(Math.max(Math.abs(position.tilt), 0), 60);
  const tiltAbsRad = (tiltAbsDeg * Math.PI) / 180;
  const hereZoomOrig = ZoomAltitudeConverter.googleZoomToHereZoom(position.zoom, position.position.latitude);
  const altitude = converter.zoomLevelToAltitude({
    zoomLevel: hereZoomOrig,
    latitude: position.position.latitude,
    tilt: 0,
  });
  const distanceForward = altitude
    * Math.cos(tiltAbsRad)
    * Math.tan(tiltAbsRad)
    * NEGATIVE_TILT_TARGET_DISTANCE_SCALE;
  const target = computeOffset({
    origin: position.position,
    distance: distanceForward,
    heading: position.bearing,
  });
  const adjustedGoogleZoom = position.zoom
    + NEGATIVE_TILT_ZOOM_OFFSET_AT_MAX_TILT * (tiltAbsDeg / 60);
  const adjustedHereZoom = ZoomAltitudeConverter.googleZoomToHereZoom(
    adjustedGoogleZoom,
    target.latitude,
  );
  return {
    target,
    tiltDeg: tiltAbsDeg,
    hereZoomLevel: adjustedHereZoom,
    bearing: position.bearing,
  };
}

/** Mirrors `MapCameraPosition.toMapCameraUpdate()` in Android. */
export function toHereLookAtData(position: MapCameraPosition): H.map.ViewLookAtData {
  const display = toHereDisplayCamera(position);
  return {
    position: toGeoCoordinates(display.target),
    zoom: display.hereZoomLevel,
    // HERE JS v3 has no usable bearing/tilt camera controls. The React view
    // applies both values to its oversized map plane with CSS transforms.
    heading: 0,
    tilt: 0,
  };
}

/** Mirrors `MapCameraPosition.from(position: MapCameraPositionInterface)`. */
export function mapCameraPositionFrom(
  position: MapCameraPositionInterface,
): MapCameraPosition {
  return createMapCameraPosition({
    position: position.position,
    zoom: position.zoom,
    bearing: position.bearing,
    tilt: position.tilt,
    paddings: position.paddings,
    visibleRegion: position.visibleRegion,
  });
}

/**
 * Mirrors `MapCamera.State.toMapCameraPosition(logicalTiltHint)` in Android.
 * HERE JS ViewModel reports a positive tilt; pass the last requested tilt to
 * recover the original logical position when the camera was shifted to fake a
 * negative tilt.
 */
export function lookAtToMapCameraPosition(
  lookAt: H.map.ViewLookAt,
  logicalTiltHint: number | null = null,
): MapCameraPosition {
  const pitch = lookAt.tilt;
  const pitchAbsDeg = Math.min(Math.max(Math.abs(pitch), 0), 90);

  if (logicalTiltHint == null || logicalTiltHint >= 0.0 || pitchAbsDeg === 0.0) {
    const position = createGeoPoint({ latitude: lookAt.position.lat, longitude: lookAt.position.lng });
    const googleZoom = ZoomAltitudeConverter.hereZoomToGoogleZoom(lookAt.zoom, position.latitude);
    return createMapCameraPosition({
      position,
      zoom: googleZoom,
      bearing: lookAt.heading,
      tilt: pitch,
    });
  }

  // Recover original position and zoom from shifted camera state (tilt < 0 case)
  const pitchAbsRad = (pitchAbsDeg * Math.PI) / 180;
  const shiftedCenter = createGeoPoint({ latitude: lookAt.position.lat, longitude: lookAt.position.lng });
  const bear = lookAt.heading;

  const adjustedAltitude = converter.zoomLevelToAltitude({
    zoomLevel: lookAt.zoom,
    latitude: shiftedCenter.latitude,
    tilt: 0,
  });
  const originalAltitude = adjustedAltitude * Math.cos(pitchAbsRad);
  const distanceBackward = originalAltitude * Math.tan(pitchAbsRad);
  const originalPosition = computeOffset({
    origin: shiftedCenter,
    distance: distanceBackward,
    heading: bear + 180.0,
  });
  const originalHereZoom = converter.altitudeToZoomLevel({
    altitude: originalAltitude,
    latitude: originalPosition.latitude,
    tilt: 0,
  });
  const originalGoogleZoom = ZoomAltitudeConverter.hereZoomToGoogleZoom(
    originalHereZoom,
    originalPosition.latitude,
  );

  return createMapCameraPosition({
    position: originalPosition,
    zoom: originalGoogleZoom,
    bearing: bear,
    tilt: -pitchAbsDeg,
  });
}
