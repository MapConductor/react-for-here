import type { AttributionRule, MapDesignTypeInterface } from '@mapconductor/js-sdk-core';

/**
 * Mirrors `HereMapDesignType` in `android-for-here/.../HereMapDesign.kt`:
 * `typealias HereMapDesignType = MapDesignTypeInterface<MapScheme>`.
 *
 * `MapScheme` here is the HERE Maps API for JavaScript style string
 * (e.g. `H.map.style.NormalDay`). Android uses the equivalent
 * `com.here.sdk.mapview.MapScheme` enum value.
 */
export type HereMapDesignType = MapDesignTypeInterface<string>;

/**
 * Mirrors `HereMapDesign` (sealed class) in Android. Each Android `object`
 * (`NormalDay`, `NormalNight`, `Satellite`, ...) maps to a `static` here.
 * The JavaScript style strings come from `H.map.style.*`.
 */
export class HereMapDesign implements HereMapDesignType {
  readonly id: string;
  readonly attributionRules: readonly AttributionRule[];

  constructor(id: string, attributionRules: readonly AttributionRule[] = []) {
    this.id = id;
    this.attributionRules = attributionRules;
  }

  getValue(): string {
    return this.id;
  }

  // --- Android aligned singletons -------------------------------------------

  /** `MapScheme.NORMAL_DAY` */
  static readonly NormalDay: HereMapDesign = new HereMapDesign(
    // Populated lazily once `H.map.style.NormalDay` is available at runtime.
    'normal.day',
  );
  /** `MapScheme.NORMAL_NIGHT` */
  static readonly NormalNight: HereMapDesign = new HereMapDesign('normal.night');
  /** `MapScheme.SATELLITE` */
  static readonly Satellite: HereMapDesign = new HereMapDesign('satellite.day');
  /** `MapScheme.HYBRID_DAY` */
  static readonly HybridDay: HereMapDesign = new HereMapDesign('hybrid.day');
  /** `MapScheme.HYBRID_NIGHT` */
  static readonly HybridNight: HereMapDesign = new HereMapDesign('hybrid.night');
  /** `MapScheme.LITE_DAY` */
  static readonly LiteDay: HereMapDesign = new HereMapDesign('lite.day');
  /** `MapScheme.LITE_NIGHT` */
  static readonly LiteNight: HereMapDesign = new HereMapDesign('lite.night');
  /** `MapScheme.LITE_HYBRID_DAY` */
  static readonly LiteHybridDay: HereMapDesign = new HereMapDesign('lite.hybrid.day');
  /** `MapScheme.LITE_HYBRID_NIGHT` */
  static readonly LiteHybridNight: HereMapDesign = new HereMapDesign('lite.hybrid.night');
  /** `MapScheme.LOGISTICS_DAY` */
  static readonly LogisticsDay: HereMapDesign = new HereMapDesign('logistics.day');
  /** `MapScheme.LOGISTICS_NIGHT` */
  static readonly LogisticsNight: HereMapDesign = new HereMapDesign('logistics.night');
  /** `MapScheme.LOGISTICS_HYBRID_DAY` */
  static readonly LogisticsHybridDay: HereMapDesign = new HereMapDesign('logistics.hybrid.day');
  /** `MapScheme.ROAD_NETWORK_DAY` */
  static readonly RoadNetworkDay: HereMapDesign = new HereMapDesign('road.network.day');
  /** `MapScheme.ROAD_NETWORK_NIGHT` */
  static readonly RoadNetworkNight: HereMapDesign = new HereMapDesign('road.network.night');

  /** `HereMapDesign.Custom(id, attributionRules)` */
  static Custom(id: string, attributionRules: readonly AttributionRule[] = []): HereMapDesign {
    return new HereMapDesign(id, attributionRules);
  }

  /**
   * Mirrors `HereMapDesign.create(id: Int): HereMapDesign` in Android, but
   * dispatches by the string id rather than the integer enum value.
   */
  static create(id: string): HereMapDesign {
    const all: HereMapDesign[] = [
      HereMapDesign.NormalDay,
      HereMapDesign.NormalNight,
      HereMapDesign.Satellite,
      HereMapDesign.HybridDay,
      HereMapDesign.HybridNight,
      HereMapDesign.LiteDay,
      HereMapDesign.LiteNight,
      HereMapDesign.LiteHybridDay,
      HereMapDesign.LiteHybridNight,
      HereMapDesign.LogisticsDay,
      HereMapDesign.LogisticsNight,
      HereMapDesign.LogisticsHybridDay,
      HereMapDesign.RoadNetworkDay,
      HereMapDesign.RoadNetworkNight,
    ];
    const match = all.find((design) => design.id === id);
    if (!match) {
      throw new Error(`Unsupported MapScheme: ${id}`);
    }
    return match;
  }
}
