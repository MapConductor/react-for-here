// Native-safe entry point: only the plain-data view state and design types, with no static
// import of the HERE Maps JS API glue. `./index.ts`'s barrel pulls in `HereMapView2D.web` and
// `HereViewControllerStore` - fine for bundlers targeting a browser, but unnecessary weight for
// Metro/Hermes, which evaluates the barrel eagerly.
// RN 向けの入口として残してある。`reactnative-for-here` は配布しないことにして消したが
// （proprietary な heresdk をレジストリ経由で配れないため）、サブパス自体は公開 API なので
// 動かさない。他プロバイダの RN パッケージは同じ形でここから取る。
// Same arrangement as `react-for-maplibre/src/state.ts` / `react-for-arcgis/src/state.ts`.
export { HereMapDesign, type HereMapDesignType } from './HereMapDesign';
export {
  HereViewState,
  useHereViewState,
  type HereViewStateInterface,
  type HereViewStateParams,
} from './HereViewState';
