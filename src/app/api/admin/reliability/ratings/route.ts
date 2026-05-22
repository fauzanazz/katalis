import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeReliabilityRequest } from "@/lib/reliability/auth";
import { submitRating } from "@/lib/reliability/service";
import { INTEREST_TAXONOMY_V1 } from "@/lib/interests/taxonomy";
import { TAG_CATEGORIES } from "@/lib/ai/tag-schemas";

const BodySchema = z.object({
  discoveryId: z.string().min(1),
  humanInterestKeys: z.array(z.enum(INTEREST_TAXONOMY_V1)).max(64),
  humanTagCategories: z.array(z.enum(TAG_CATEGORIES)).max(16),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authorizeReliabilityRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }
  if (auth.via !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const created = await submitRating({
      discoveryId: parsed.data.discoveryId,
      raterUserId: auth.userId,
      humanInterestKeys: parsed.data.humanInterestKeys,
      humanTagCategories: parsed.data.humanTagCategories,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ ratingId: created.id });
  } catch (error) {
    const message = (error as Error).message ?? "submission_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
