export const ZPD_BANDS = [
  "emerging",
  "developing",
  "proficient",
  "extending",
] as const;

export type ZpdBand = (typeof ZPD_BANDS)[number];

export function scoreToBand(score: number): ZpdBand {
  const s = Math.max(0, Math.min(1, score));
  if (s < 0.25) return "emerging";
  if (s < 0.5) return "developing";
  if (s < 0.75) return "proficient";
  return "extending";
}

export function bandRank(band: ZpdBand): number {
  return ZPD_BANDS.indexOf(band);
}
