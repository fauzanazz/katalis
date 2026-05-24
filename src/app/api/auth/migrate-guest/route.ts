import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function generateAccessCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += chars.charAt(randomInt(chars.length));
  return `KATAL-${suffix}`;
}

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

const MigrateGuestSchema = z.object({
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

/**
 * POST /api/auth/migrate-guest
 * Called immediately after registration to persist guest session data.
 * Best-effort: failures don't block the registration flow.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    const parsed = MigrateGuestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "validation", details: parsed.error.issues }, { status: 400 });
    }

    const { childName, childDob, history, quest } = parsed.data;

    // Need at least a DOB to create a valid child record
    const hasChildData = !!childDob;
    const hasHistory = history && history.length > 0;
    const hasQuest = !!quest && quest.missions.length > 0;

    if (!hasChildData && !hasHistory && !hasQuest) {
      return NextResponse.json({ success: true, migrated: false });
    }

    if (!hasChildData) {
      // Can't create child without DOB — nothing to migrate
      return NextResponse.json({ success: true, migrated: false, reason: "no_dob" });
    }

    const dob = new Date(childDob);

    await prisma.$transaction(async (tx) => {
      // Generate unique access code
      let code: string;
      let attempts = 0;
      do {
        code = generateAccessCode();
        if (++attempts > 10) throw new Error("Failed to generate unique access code");
        const existing = await tx.accessCode.findUnique({ where: { code } });
        if (!existing) break;
      } while (true);

      const newAccessCode = await tx.accessCode.create({
        data: {
          code: code!,
          active: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });

      const child = await tx.child.create({
        data: {
          name: childName ?? null,
          dateOfBirth: dob,
          accessCodeId: newAccessCode.id,
        },
      });

      await tx.parentChild.create({
        data: {
          userId: session.userId,
          childId: child.id,
          consentGivenAt: new Date(),
          consentTextVersion: "v1",
        },
      });

      // Persist discovery history
      let firstDiscoveryId: string | null = null;
      if (hasHistory) {
        for (const item of history) {
          const discovery = await tx.discovery.create({
            data: {
              childId: child.id,
              type: item.type,
              fileUrl: item.fileUrl,
              detectedTalents: JSON.stringify(item.talents),
              createdAt: new Date(item.createdAt),
            },
          });
          if (firstDiscoveryId === null) firstDiscoveryId = discovery.id;
        }
      }

      // Persist quest
      if (hasQuest) {
        await tx.quest.create({
          data: {
            childId: child.id,
            discoveryId: firstDiscoveryId,
            dream: quest.dream,
            localContext: quest.localContext,
            status: "active",
            generatedAt: new Date(),
            missions: {
              create: quest.missions.map((m) => ({
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
            },
          },
        });
      }
    });

    return NextResponse.json({ success: true, migrated: true });
  } catch (error) {
    console.error("migrate-guest error:", error);
    // Non-fatal — registration already succeeded
    return NextResponse.json({ success: false, error: "internal" }, { status: 500 });
  }
}
