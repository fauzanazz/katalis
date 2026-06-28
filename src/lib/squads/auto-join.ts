import { db } from "@/lib/db";
import { squads, squadMembers } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

// Maps keywords (lowercase) in talentCategory to a canonical squad theme
const THEME_KEYWORDS: Array<[keyword: string, theme: string]> = [
  ["engineering", "Engineering"],
  ["mekanika", "Engineering"],
  ["visual arts", "Visual Arts"],
  ["seni visual", "Visual Arts"],
  ["composition", "Visual Arts"],
  ["art", "Visual Arts"],
  ["storytelling", "Storytelling"],
  ["narrative", "Storytelling"],
  ["music", "Music"],
  ["science", "Science"],
  ["leadership", "Leadership"],
  ["empathy", "Empathy"],
  ["creative", "Creative"],
];

function resolveTheme(talentCategory: string): string | null {
  const lower = talentCategory.toLowerCase();
  for (const [keyword, theme] of THEME_KEYWORDS) {
    if (lower.includes(keyword)) return theme;
  }
  return null;
}

/**
 * Auto-joins a child into the squad matching their talent category,
 * and prepends the gallery entry to the squad's featured list (max 20).
 * Safe to call multiple times — membership upsert is idempotent.
 */
export async function autoJoinSquad(
  childId: string,
  talentCategory: string,
  entryId: string,
  country: string | null,
): Promise<void> {
  const theme = resolveTheme(talentCategory);
  if (!theme) return;

  const squad = await db.query.squads.findFirst({
    where: and(eq(squads.theme, theme), eq(squads.status, "active")),
  });
  if (!squad) return;

  await db.insert(squadMembers)
    .values({ squadId: squad.id, childId })
    .onConflictDoNothing();

  const current = JSON.parse(squad.featuredEntryIds) as string[];
  const updated = [entryId, ...current.filter((id) => id !== entryId)].slice(0, 20);

  const countries = JSON.parse(squad.countries) as string[];
  if (country && !countries.includes(country)) countries.push(country);

  await db.update(squads)
    .set({
      featuredEntryIds: JSON.stringify(updated),
      countries: JSON.stringify(countries),
    })
    .where(eq(squads.id, squad.id));
}
