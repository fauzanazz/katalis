/**
 * Seeds category-based squads and backfills existing gallery entries.
 * Safe to re-run — deletes only squad/squadMembers rows then re-creates.
 * Run: bun scripts/seed-squads.ts
 */
import { eq, desc } from "drizzle-orm";
import { db } from "../src/lib/db";
import { squads, squadMembers, galleryEntries } from "../src/lib/schema";

const CATEGORY_SQUADS = [
  {
    name: "The Makers Guild",
    theme: "Engineering",
    description: "Young builders and tinkerers solving real-world problems with creative engineering.",
    icon: "🤖",
  },
  {
    name: "Visual Dreamers",
    theme: "Visual Arts",
    description: "Artists expressing their world through drawing, painting, and visual storytelling.",
    icon: "🎨",
  },
  {
    name: "Story Weavers",
    theme: "Storytelling",
    description: "Young authors and narrators crafting tales that inspire and connect.",
    icon: "📖",
  },
  {
    name: "Creative Sparks",
    theme: "Creative",
    description: "Imaginative minds exploring the intersection of ideas, art, and innovation.",
    icon: "✨",
  },
  {
    name: "Melody Makers",
    theme: "Music",
    description: "Musicians and composers creating harmonies that bring joy to the world.",
    icon: "🎵",
  },
  {
    name: "Curious Minds",
    theme: "Science",
    description: "Young scientists and explorers curious about how the world works.",
    icon: "🔬",
  },
  {
    name: "Future Leaders",
    theme: "Leadership",
    description: "Emerging leaders learning to inspire and make a positive impact.",
    icon: "🏆",
  },
  {
    name: "Heart Connectors",
    theme: "Empathy",
    description: "Compassionate children building bridges across communities and cultures.",
    icon: "💚",
  },
];

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

async function main() {
  console.log("Clearing existing squads and memberships...");
  await db.delete(squadMembers);
  await db.delete(squads);

  console.log("Seeding category squads...");
  const inserted = await db.insert(squads)
    .values(
      CATEGORY_SQUADS.map((s) => ({
        ...s,
        countries: "[]",
        featuredEntryIds: "[]",
        status: "active" as const,
      }))
    )
    .returning();

  const themeToSquad = new Map(inserted.map((s) => [s.theme, s]));
  console.log(`Created ${inserted.length} squads.`);

  // Collect backfill data per squad
  const entries = await db.query.galleryEntries.findMany({
    orderBy: desc(galleryEntries.createdAt),
  });

  console.log(`Backfilling ${entries.length} existing gallery entries...`);

  type SquadAccum = { entryIds: string[]; countries: Set<string>; childIds: Set<string> };
  const accum = new Map<string, SquadAccum>(
    inserted.map((s) => [s.id, { entryIds: [], countries: new Set(), childIds: new Set() }]),
  );

  for (const entry of entries) {
    const theme = resolveTheme(entry.talentCategory);
    if (!theme) continue;
    const squad = themeToSquad.get(theme);
    if (!squad) continue;
    const a = accum.get(squad.id)!;
    if (a.entryIds.length < 20) a.entryIds.push(entry.id);
    if (entry.country) a.countries.add(entry.country);
    a.childIds.add(entry.childId);
  }

  for (const [squadId, { entryIds, countries, childIds }] of accum) {
    if (entryIds.length === 0) continue;

    await db.update(squads)
      .set({
        featuredEntryIds: JSON.stringify(entryIds),
        countries: JSON.stringify([...countries]),
      })
      .where(eq(squads.id, squadId));

    if (childIds.size > 0) {
      await db.insert(squadMembers)
        .values([...childIds].map((childId) => ({ squadId, childId })))
        .onConflictDoNothing();
    }

    console.log(`  Squad ${squadId}: ${entryIds.length} entries, ${childIds.size} members`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
