import { NextRequest, NextResponse } from "next/server";
import { authorizeReliabilityRequest } from "@/lib/reliability/auth";
import { listUnacknowledgedAlerts } from "@/lib/reliability/repository";

export async function GET(request: NextRequest) {
  const auth = await authorizeReliabilityRequest(request);
  if (!auth.ok || auth.via !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const alerts = await listUnacknowledgedAlerts();
  return NextResponse.json({ alerts });
}
