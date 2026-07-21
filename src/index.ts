// HERE Maps API for JavaScript provider for the MapConductor React SDK.
//
// Class and module names mirror the sibling Android SDK
// (`android-for-here/.../com/mapconductor/here/*`).

export { HereMapDesign } from './HereMapDesign';
export type { HereMapDesignType } from './HereMapDesign';

export { HereViewHolder } from './HereViewHolder';

export { HereViewState, useHereViewState } from './HereViewState';
export type { HereViewStateInterface, HereViewStateParams } from './HereViewState';

export { HereProvider } from './HereProvider';
export type { HereConfig } from './HereProvider';

export { HereMapView2D } from './HereMapView2D.web';
export type { HereMapView2DProps } from './HereMapView2D.web';

export { HereMapViewController, HereDesignId } from './HereMapViewController';
export type { HereMapDesignTypeChangeHandler } from './HereMapViewControllerInterface';
export type { HereMapViewControllerInterface } from './HereMapViewControllerInterface';

export { HereMapViewControllerStore, setHerePlatform, getHerePlatform } from './HereViewControllerStore';

export type {
  HereActualMarker,
  HereActualPolyline,
  HereActualPolygon,
  HereActualCircle,
  HereActualGroundImage,
} from './HereTypeAlias';

export { ZoomAltitudeConverter } from './zoom/ZoomAltitudeConverter';
export {
  toHereDisplayCamera,
  toHereLookAtData,
  mapCameraPositionFrom,
  lookAtToMapCameraPosition,
} from './MapCameraPosition';
export { toGeoCoordinates, toGeoPoint, geoPointFromLatLng } from './GeoPoint';
export { toGeoRect, toGeoRectBounds } from './GeoRectBounds';
export { toMapImage, toAnchor2D } from './BitmapIcon';
export type { HereViewInitOptions } from './HereViewInitOptions';
