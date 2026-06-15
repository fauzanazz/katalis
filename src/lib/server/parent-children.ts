import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { children, parentChildren } from "@/lib/schema";
import { getUserSession, isStepUpFresh, setActiveChild } from "@/lib/auth-start";
import { getParentChildren, verifyParentChildLink } from "@/lib/parent/link";
import { getTipsForChild, getAllTips } from "@/lib/parent/home-tips";
import { listSnapshots } from "@/lib/zpd/repository";
import { getAgeGroup } from "@/lib/age";
import { ok, err, type Result } from "@/lib/server/result";

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface ZpdSnapshotView {
  id: string;
  score: number;
  band: string;
  createdAt: string;
}

export interface QuestView {
  id: string;
  dream: string;
  status: string;
}

export interface TipView {
  title: string;
  description: string;
  materials: string[];
  category: string;
}

export interface ParentChildView {
  id: string;
  name?: string;
  locale: string;
  claimedAt: string;
  dateOfBirth: string | null;
  ageGroup: "3-6" | "7-9" | "10-12" | "unknown";
  latestTalents: string[];
  questCount: number;
  quests: QuestView[];
  tips: TipView[];
  zpdSnapshots: ZpdSnapshotView[];
}

export interface CreatedChild {
  id: string;
  name: string | null;
  locale: string;
  dateOfBirth: string;
  createdAt: string;
}

export interface UpdatedChildDob {
  id: string;
  name: string | null;
  locale: string;
  dateOfBirth: string;
}

// ---------------------------------------------------------------------------
// 1. listParentChildrenFn
// ---------------------------------------------------------------------------

export const listParentChildrenFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ children: ParentChildView[] }>> => {
    const session = await getUserSession();
    if (!session) return err("unauthorized", "Authentication required");

    const linked = await getParentChildren(session.userId);

    const enriched: ParentChildView[] = await Promise.all(
      linked.map(async (child) => {
        const snapshots = await listSnapshots(child.id, 30).catch((error) => {
          console.error(`ZPD snapshot fetch failed for child ${child.id}:`, error);
          return [];
        });

        return {
          id: child.id,
          name: child.name,
          locale: child.locale,
          claimedAt: child.claimedAt,
          dateOfBirth: child.dateOfBirth ?? null,
          ageGroup: child.ageGroup ?? "unknown",
          latestTalents: child.latestTalents ?? [],
          questCount: child.questCount ?? 0,
          quests: child.quests ?? [],
          tips: getTipsForChild({ talents: child.latestTalents ?? [] }),
          zpdSnapshots: snapshots.map((s) => ({
            id: s.id,
            score: s.score,
            band: s.band,
            createdAt: s.createdAt.toISOString(),
          })),
        };
      }),
    );

    return ok({ children: enriched });
  },
);

// ---------------------------------------------------------------------------
// 2. createChildFn
// ---------------------------------------------------------------------------

const CreateChildSchema = z.object({
  name: z.string().min(1).max(50),
  locale: z.enum(["en", "id", "zh"]).optional(),
  dateOfBirth: z.string().datetime({ message: "dateOfBirth must be an ISO datetime string" }),
});

export const createChildFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateChildSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ child: CreatedChild }>> => {
    const session = await getUserSession();
    if (!session) return err("unauthorized", "Authentication required");

    const { name, locale = "id", dateOfBirth } = data;
    const dob = new Date(dateOfBirth);

    const { years } = getAgeGroup(dob);
    if (years === null || years < 3 || years > 12) {
      return err("invalid", "dateOfBirth must indicate an age between 3 and 12 years.");
    }

    const child = await db.transaction(async (tx) => {
      const newChild = (
        await tx
          .insert(children)
          .values({ name, locale, dateOfBirth: dob })
          .returning({
            id: children.id,
            name: children.name,
            locale: children.locale,
            dateOfBirth: children.dateOfBirth,
            createdAt: children.createdAt,
          })
      )[0];

      await tx.insert(parentChildren).values({
        userId: session.userId,
        childId: newChild.id,
        consentGivenAt: new Date(),
        consentTextVersion: "v1",
      });

      return newChild;
    });

    return ok({
      child: {
        id: child.id,
        name: child.name ?? null,
        locale: child.locale,
        dateOfBirth: (child.dateOfBirth as Date).toISOString(),
        createdAt: (child.createdAt as Date).toISOString(),
      },
    });
  });

// ---------------------------------------------------------------------------
// 3. updateChildDobFn
// ---------------------------------------------------------------------------

const UpdateChildDobSchema = z.object({
  childId: z.string().min(1),
  dateOfBirth: z.string().datetime({ message: "dateOfBirth must be an ISO datetime string" }),
});

export const updateChildDobFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => UpdateChildDobSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ child: UpdatedChildDob }>> => {
    const session = await getUserSession();
    if (!session) return err("unauthorized", "Authentication required");

    const linked = await verifyParentChildLink(session.userId, data.childId);
    if (!linked) return err("forbidden", "Access denied");

    const dob = new Date(data.dateOfBirth);
    const { years } = getAgeGroup(dob);
    if (years === null || years < 3 || years > 12) {
      return err("invalid", "dateOfBirth must indicate an age between 3 and 12 years.");
    }

    const updated = (
      await db
        .update(children)
        .set({ dateOfBirth: dob })
        .where(eq(children.id, data.childId))
        .returning({
          id: children.id,
          name: children.name,
          locale: children.locale,
          dateOfBirth: children.dateOfBirth,
        })
    )[0];

    return ok({
      child: {
        id: updated.id,
        name: updated.name ?? null,
        locale: updated.locale,
        dateOfBirth: (updated.dateOfBirth as Date).toISOString(),
      },
    });
  });

// ---------------------------------------------------------------------------
// 4. switchActiveChildFn
// ---------------------------------------------------------------------------

const SwitchActiveChildSchema = z.object({
  childId: z.string().min(1),
});

export const switchActiveChildFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => SwitchActiveChildSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ childId: string }>> => {
    const session = await getUserSession();
    if (!session) return err("unauthorized", "Authentication required");

    const link = await db.query.parentChildren.findFirst({
      where: and(
        eq(parentChildren.userId, session.userId),
        eq(parentChildren.childId, data.childId),
      ),
    });

    if (!link) return err("forbidden", "No parent-child link found");

    await setActiveChild(data.childId);

    return ok({ childId: data.childId });
  });

// ---------------------------------------------------------------------------
// 5. getParentTipsFn
// ---------------------------------------------------------------------------

const GetParentTipsSchema = z.object({
  category: z.string().optional(),
});

export const getParentTipsFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => GetParentTipsSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ tips: TipView[] }>> => {
    const session = await getUserSession();
    if (!session) return err("unauthorized", "Authentication required");

    const tips = getAllTips(data.category);
    return ok({ tips });
  });

// ---------------------------------------------------------------------------
// 6. unlinkChildFn (step-up gated)
// ---------------------------------------------------------------------------

const UnlinkChildSchema = z.object({
  childId: z.string().min(1),
});

export const unlinkChildFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => UnlinkChildSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ unlinked: true }>> => {
    const session = await getUserSession();
    if (!session) return err("unauthorized", "Authentication required");

    // Step-up before ownership: matches the original DELETE handler + the other
    // gated parent fns (reset/delete), and gives the stronger guarantee that the
    // endpoint can't be probed as an ownership oracle without re-authentication.
    if (!(await isStepUpFresh())) return err("step_up_required", "Password re-authentication required");

    const linked = await verifyParentChildLink(session.userId, data.childId);
    if (!linked) return err("forbidden", "Access denied");

    await db
      .delete(parentChildren)
      .where(
        and(
          eq(parentChildren.userId, session.userId),
          eq(parentChildren.childId, data.childId),
        ),
      );

    return ok({ unlinked: true as const });
  });
