import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc, count } from "drizzle-orm";

import { db } from "@/lib/db";
import { accessCodes, children } from "@/lib/schema";
import { getAdminSession } from "@/lib/auth-start";
import { ok, err, type Result } from "@/lib/server/result";

// ---------------------------------------------------------------------------
// Shared output shape
// ---------------------------------------------------------------------------

export interface AccessCodeView {
  id: string;
  code: string;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  childCount: number;
}

// ---------------------------------------------------------------------------
// listAccessCodesFn — GET, paginated, admin-gated
// ---------------------------------------------------------------------------

const ListCodesSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const listAccessCodesFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => ListCodesSchema.parse(d ?? {}))
  .handler(
    async ({ data }): Promise<Result<{ codes: AccessCodeView[] }>> => {
      const admin = await getAdminSession();
      if (!admin) return err("unauthorized", "Admin access required");

      const page = Math.max(1, data.page ?? 1);
      const limit = Math.min(100, Math.max(1, data.limit ?? 20));
      const offset = (page - 1) * limit;

      const rows = await db
        .select({
          id: accessCodes.id,
          code: accessCodes.code,
          active: accessCodes.active,
          expiresAt: accessCodes.expiresAt,
          createdAt: accessCodes.createdAt,
          childCount: count(children.id),
        })
        .from(accessCodes)
        .leftJoin(children, eq(children.accessCodeId, accessCodes.id))
        .groupBy(accessCodes.id)
        .orderBy(desc(accessCodes.createdAt))
        .limit(limit)
        .offset(offset);

      return ok({
        codes: rows.map((row) => ({
          id: row.id,
          code: row.code,
          active: row.active,
          expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
          createdAt: row.createdAt.toISOString(),
          childCount: row.childCount,
        })),
      });
    },
  );

// ---------------------------------------------------------------------------
// createAccessCodeFn — POST, admin-gated
// ---------------------------------------------------------------------------

const CreateCodeSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const createAccessCodeFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateCodeSchema.parse(d))
  .handler(
    async ({ data }): Promise<Result<{ code: AccessCodeView }>> => {
      const admin = await getAdminSession();
      if (!admin) return err("unauthorized", "Admin access required");

      const codeValue = data.code ?? generateCode();

      if (data.code) {
        const existing = await db.query.accessCodes.findFirst({
          where: eq(accessCodes.code, codeValue),
        });
        if (existing) return err("code_exists", "Access code already exists");
      }

      const [inserted] = await db
        .insert(accessCodes)
        .values({
          code: codeValue,
          active: true,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        })
        .returning({
          id: accessCodes.id,
          code: accessCodes.code,
          active: accessCodes.active,
          expiresAt: accessCodes.expiresAt,
          createdAt: accessCodes.createdAt,
        });

      return ok({
        code: {
          id: inserted.id,
          code: inserted.code,
          active: inserted.active,
          expiresAt: inserted.expiresAt ? inserted.expiresAt.toISOString() : null,
          createdAt: inserted.createdAt.toISOString(),
          childCount: 0,
        },
      });
    },
  );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join(""),
  );
  return segments.join("-");
}
