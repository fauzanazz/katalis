/**
 * Shared types for the inter-rater reliability module.
 * See docs/plans/2026-05-22-reliability-kappa-design.md.
 */

/**
 * Inter-rater Kappa layers (existing). `ReliabilityLayer` is the broader
 * union for ReliabilitySnapshot/Alert rows: it adds the §1.3a `test_retest`
 * and §1.3c `longitudinal_validity` layers persisted via separate paths
 * (see test-retest.ts, longitudinal.ts).
 */
export type Layer = "interest_keys" | "tag_categories";

export type ReliabilityLayer =
  | Layer
  | "test_retest"
  | "longitudinal_validity"
  | "bias_monitor";

export const LAYERS: readonly Layer[] = ["interest_keys", "tag_categories"] as const;

/** One rated discovery: AI's labels vs human's labels, both as sets over the layer domain. */
export interface RatingPair {
  aiLabels: ReadonlySet<string>;
  humanLabels: ReadonlySet<string>;
}

/** 2x2 binary confusion for a single label across many items. */
export interface BinaryConfusion {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
}

export interface PerLabelKappa {
  label: string;
  kappa: number;
  /** Number of items in which either AI or human selected this label (positive support). */
  support: number;
  confusion: BinaryConfusion;
}

export interface ConfusedPair {
  aiLabel: string;
  humanLabel: string;
  count: number;
}

export interface MacroKappaResult {
  /** Macro-averaged Kappa across non-skipped labels. Null if sample empty. */
  kappa: number | null;
  /** Sample size (number of rated items provided as input). */
  sampleSize: number;
  perLabel: PerLabelKappa[];
  /** Labels that were excluded from the average because both AI and human never picked them. */
  skipped: string[];
  topConfused: ConfusedPair[];
}

export interface MacroKappaOptions {
  /** Default 5. Top-N pairs returned. */
  topConfusedCount?: number;
  /**
   * If true, labels with zero positive observations in both AI and human contribute
   * Kappa = 0 to the average instead of being skipped. Default false.
   */
  strict?: boolean;
}
