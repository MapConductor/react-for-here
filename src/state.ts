// Native-safe entry point: only the plain-data view state and design types, with no static
// import of the HERE Maps JS API glue. `./index.ts`'s barrel pulls in `HereMapView2D.web` and
// `HereViewControllerStore` - fine for bundlers targeting a browser, but unnecessary weight for
// Metro/Hermes, which evaluates the barrel eagerly.
// `@mapconductor/reactnative-for-here` imports from here instead of the root barrel.
// Same arrangement as `react-for-maplibre/src/state.ts` / `react-for-arcgis/src/state.ts`.
export { HereMapDesign, type HereMapDesignType } from './HereMapDesign';
export {
  HereViewState,
  useHereViewState,
  type HereViewStateInterface,
  type HereViewStateParams,
} from './HereViewState';
