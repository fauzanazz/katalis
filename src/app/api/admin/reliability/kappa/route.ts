import { NextRequest, NextResponse } from "next/server";
import { authorizeReliabilityRequest } from "@/lib/reliability/auth";
import { computeLiveKappa } from "@/lib/reliability/service";
import type { Layer } from "@/lib/reliability/types";

function asLayer(value: string | null): Layer | null {
  if (value === "interest_keys" || value === "tag_categories") return value;
  return null;
}

export async function GET(request: NextRequest) {
  const auth = await authorizeReliabilityRequest(request);
  if (!auth.ok || auth.via !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const layer = asLayer(request.nextUrl.searchParams.get("layer"));
  if (!layer) {
    return NextResponse.json(
      { error: "layer must be 'interest_keys' or 'tag_categories'" },
      { status: 400 },
    );
  }

  const result = await computeLiveKappa(layer);
  return NextResponse.json(result);
}
