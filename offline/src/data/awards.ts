import { awardBadge, listGallery, listProgress } from "./store";

/**
 * Offline badge rules. Maps purely local activity (missions done, quests
 * finished, gallery items, mentor use) onto the shared badge slugs in
 * src/lib/badges/definitions. Idempotent: returns only the slugs newly earned
 * by this evaluation so the caller can celebrate them.
 */
export async function evaluateAwards(
  profileId: string,
  ctx: { mentorUsed?: boolean } = {},
): Promise<string[]> {
  const [progress, gallery] = await Promise.all([
    listProgress(profileId),
    listGallery(profileId),
  ]);

  const missionsDone = progress.reduce((n, p) => n + p.completedMissionIds.length, 0);
  const questsDone = progress.filter((p) => p.completedAt).length;

  const rules: Array<{ slug: string; earned: boolean }> = [
    { slug: "first_step", earned: missionsDone >= 1 },
    { slug: "reflector", earned: missionsDone >= 3 },
    { slug: "deep_thinker", earned: missionsDone >= 7 },
    { slug: "week_warrior", earned: questsDone >= 1 },
    { slug: "persistent_explorer", earned: questsDone >= 2 },
    { slug: "storyteller", earned: gallery.length >= 1 },
    { slug: "creative_adapter", earned: gallery.length >= 3 },
    { slug: "trailblazer", earned: Boolean(ctx.mentorUsed) },
  ];

  const newlyEarned: string[] = [];
  for (const { slug, earned } of rules) {
    if (earned && (await awardBadge(profileId, slug))) newlyEarned.push(slug);
  }
  return newlyEarned;
}
