import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  children,
  children as childrenTable,
  parentChildren,
  discoveries,
  quests,
  missions,
} from "@/lib/schema";
import {
  getSession,
  getUserSession,
  getParentIdentity,
  getChildSession,
  createUserSession,
  clearActiveChild,
  deleteSession,
  markStepUp,
} from "@/lib/auth-start";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyPassword, hashPassword } from "@/lib/password";
import { getClientIp } from "@/lib/request-ip";
import { ok, err, type Result } from "@/lib/server/result";

// ---------------------------------------------------------------------------
// Schemas (reused verbatim from the original routes)
// ---------------------------------------------------------------------------

const EmailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const StepUpSchema = z.object({
  password: z.string().min(1),
});

const TalentSchema = z.object({
  category: z.string(),
  confidence: z.number(),
  label: z.string().optional(),
  evidence: z.string().optional(),
});

const HistoryItemSchema = z.object({
  id: z.string(),
  type: z.enum(["artifact", "story", "audio"]),
  fileUrl: z.string().nullable(),
  talents: z.array(TalentSchema),
  createdAt: z.string(),
});

const MissionSchema = z.object({
  day: z.number(),
  title: z.string(),
  description: z.string(),
  instructions: z.array(z.string()),
  materials: z.array(z.string()),
  tips: z.array(z.string()),
  estimatedMinutes: z.number().optional().nullable(),
  status: z.string().optional(),
  phase: z.string().optional().nullable(),
  intensityHint: z.number().optional().nullable(),
  intent: z.string().optional().nullable(),
});

export const MigrateGuestSchema = z.object({
  childName: z.string().min(1).max(50).optional(),
  childDob: z.string().datetime().optional(),
  history: z.array(HistoryItemSchema).max(10).optional(),
  quest: z
    .object({
      dream: z.string().min(1).max(500),
      localContext: z.string().min(1).max(500),
      missions: z.array(MissionSchema),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clientIp(): string {
  return getClientIp(new Headers(getRequestHeaders())) ?? "unknown";
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const loginParentFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => EmailLoginSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ userId: string; name: string }>> => {
    const ip = clientIp();
    const rateResult = await checkRateLimit(ip, "login");
    if (rateResult.limited) {
      return err("rate_limited", "Too many login attempts. Please try again later.");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, data.email),
      columns: { id: true, name: true, passwordHash: true, role: true },
    });
    if (!user) {
      return err("invalid", "Invalid email or password");
    }

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      return err("invalid", "Invalid email or password");
    }

    await createUserSession(user.id, user.role);
    return ok({ userId: user.id, name: user.name });
  });

export const registerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => RegisterSchema.parse(d))
  .handler(async ({ data }): Promise<Result<{ userId: string; name: string }>> => {
    const ip = clientIp();
    const rateResult = await checkRateLimit(ip, "register");
    if (rateResult.limited) {
      return err("rate_limited", "Too many attempts. Please try again later.");
    }

    const existing = await db.query.users.findFirst({ where: eq(users.email, data.email) });
    if (existing) {
      return err("email_exists");
    }

    const passwordHash = await hashPassword(data.password);
    const user = (
      await db
        .insert(users)
        .values({ email: data.email, name: data.name, passwordHash, role: "user" })
        .returning({ id: users.id, name: users.name, role: users.role })
    )[0];

    await createUserSession(user.id, user.role);
    return ok({ userId: user.id, name: user.name });
  });

export const getAuthSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession();

  if (!session) {
    return { authenticated: false as const };
  }

  const isChild = !!session.activeChildId;
  const mode = isChild ? ("child" as const) : ("parent" as const);

  let childName: string | null = null;
  if (isChild && session.activeChildId) {
    try {
      const child = await db.query.children.findFirst({
        where: eq(children.id, session.activeChildId),
        columns: { name: true },
      });
      childName = child?.name ?? null;
    } catch (error) {
      console.error("Session child lookup failed:", error);
    }
  }

  return {
    authenticated: true as const,
    mode,
    childId: session.activeChildId ?? null,
    childName,
    hasParent: !!session.userId,
  };
});

export const logoutFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<Result<Record<never, never>>> => {
    await deleteSession();
    return ok({});
  },
);

export const exitChildFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<Result<Record<never, never>>> => {
    const child = await getChildSession();
    if (!child) {
      return err("not_child", "No active child session");
    }
    await clearActiveChild();
    return ok({});
  },
);

export const stepUpFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => StepUpSchema.parse(d))
  .handler(async ({ data }): Promise<Result<Record<never, never>>> => {
    const parent = await getParentIdentity();
    if (!parent) {
      return err("unauthorized", "Authentication required");
    }

    const ip = clientIp();
    const rateResult = await checkRateLimit(ip, "step-up");
    if (rateResult.limited) {
      return err("rate_limited", "Too many attempts. Please try again later.");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, parent.userId),
      columns: { passwordHash: true },
    });
    if (!user) {
      return err("unauthorized", "Authentication required");
    }

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      return err("invalid", "Incorrect password");
    }

    await markStepUp();
    return ok({});
  });

export const migrateGuestFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => MigrateGuestSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ migrated: boolean; reason?: string }>> => {
      const session = await getUserSession();
      if (!session) {
        return err("unauthorized");
      }

      const { childName, childDob, history, quest } = data;

      const hasChildData = !!childDob;
      const hasHistory = history && history.length > 0;
      const hasQuest = !!quest && quest.missions.length > 0;

      if (!hasChildData && !hasHistory && !hasQuest) {
        return ok({ migrated: false });
      }

      if (!hasChildData) {
        return ok({ migrated: false, reason: "no_dob" });
      }

      const dob = new Date(childDob);

      await db.transaction(async (tx) => {
        const child = (
          await tx
            .insert(childrenTable)
            .values({ name: childName ?? null, dateOfBirth: dob })
            .returning()
        )[0];

        await tx.insert(parentChildren).values({
          userId: session.userId,
          childId: child.id,
          consentGivenAt: new Date(),
          consentTextVersion: "v1",
        });

        let firstDiscoveryId: string | null = null;
        if (hasHistory) {
          for (const item of history) {
            const discovery = (
              await tx
                .insert(discoveries)
                .values({
                  childId: child.id,
                  type: item.type,
                  fileUrl: item.fileUrl,
                  detectedTalents: JSON.stringify(item.talents),
                  createdAt: new Date(item.createdAt),
                })
                .returning()
            )[0];
            if (firstDiscoveryId === null) firstDiscoveryId = discovery.id;
          }
        }

        if (hasQuest) {
          const newQuest = (
            await tx
              .insert(quests)
              .values({
                childId: child.id,
                discoveryId: firstDiscoveryId,
                dream: quest.dream,
                localContext: quest.localContext,
                status: "active",
                generatedAt: new Date(),
              })
              .returning()
          )[0];

          await tx.insert(missions).values(
            quest.missions.map((m) => ({
              questId: newQuest.id,
              day: m.day,
              title: m.title,
              description: m.description,
              instructions: JSON.stringify(m.instructions),
              materials: JSON.stringify(m.materials),
              tips: JSON.stringify(m.tips),
              status: m.day === 1 ? "available" : "locked",
              phase: m.phase ?? null,
              intensityHint: m.intensityHint ?? null,
              intent: m.intent ?? null,
              estimatedMinutes: m.estimatedMinutes ?? null,
            })),
          );
        }
      });

      return ok({ migrated: true });
    },
  );
