import { describe, expect, it } from "vitest";
import fs from "node:fs";

const localeFiles = ["en", "id", "zh"] as const;

const requiredLandingPaths = [
  "landing.brandName",
  "landing.openMenu",
  "landing.navSheetTitle",
  "landing.hero.safePill",
  "landing.hero.title",
  "landing.hero.subtitle",
  "landing.hero.cta",
  "landing.hero.meta",
  "landing.problem.eyebrow",
  "landing.problem.body",
  "landing.stats.centerValue",
  "landing.stats.rightTitle",
  "landing.journey.eyebrow",
  "landing.journey.step1.title",
  "landing.journey.step5.body",
  "landing.features.eyebrow",
  "landing.features.talentScout.title",
  "landing.features.parentBridge.body",
  "landing.community.eyebrow",
  "landing.community.tagEco",
  "landing.community.boxMobilityAlt",
  "landing.closing.freeBadge",
  "landing.closing.primaryCta",
  "landing.closing.footerContact",
] as const;

function getValue(record: Record<string, unknown>, path: string) {
  return path
    .split(".")
    .reduce<unknown>(
      (current, segment) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      record,
    );
}

describe("landing locale messages", () => {
  it("includes the full landing page schema in every locale", () => {
    for (const locale of localeFiles) {
      const messages = JSON.parse(
        fs.readFileSync(`messages/${locale}.json`, "utf-8"),
      ) as Record<string, unknown>;

      for (const path of requiredLandingPaths) {
        expect(getValue(messages, path), `${locale}: ${path}`).toBeDefined();
      }
    }
  });
});
