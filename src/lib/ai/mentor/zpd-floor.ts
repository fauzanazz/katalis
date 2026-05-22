import { scoreToBand, bandRank, type ZpdBand } from "@/lib/zpd";

export type Adjustment = {
  intensityHint: number;
  copy: string;
};

export type EnforceZpdFloorOptions = {
  /** When true, instead of rejecting, raise the adjustment's intensityHint to the floor band. */
  clampInsteadOfReject?: boolean;
};

export type EnforceZpdFloorResult = {
  allowed: boolean;
  adjustment: Adjustment;
  /** Floor band derived from the child's current ZPD score. */
  floorBand: ZpdBand;
  /** Reason populated when allowed=false. */
  reason?: string;
};

const BAND_LOWER_EDGE: Record<ZpdBand, number> = {
  emerging: 0,
  developing: 0.25,
  proficient: 0.5,
  extending: 0.75,
};

export function enforceZpdFloor(
  adjustment: Adjustment,
  currentZpdScore: number,
  options: EnforceZpdFloorOptions = {},
): EnforceZpdFloorResult {
  const floorBand = scoreToBand(currentZpdScore);
  const adjustmentBand = scoreToBand(adjustment.intensityHint);

  if (bandRank(adjustmentBand) >= bandRank(floorBand)) {
    return { allowed: true, adjustment, floorBand };
  }

  if (options.clampInsteadOfReject) {
    return {
      allowed: true,
      adjustment: {
        ...adjustment,
        intensityHint: BAND_LOWER_EDGE[floorBand],
      },
      floorBand,
    };
  }

  return {
    allowed: false,
    adjustment,
    floorBand,
    reason: `Adjustment band (${adjustmentBand}) is below the ZPD floor (${floorBand}).`,
  };
}
