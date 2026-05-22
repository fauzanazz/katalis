import { NextRequest, NextResponse } from "next/server";
import { authorizeReliabilityRequest } from "@/lib/reliability/auth";
import { runSnapshotJob } from "@/lib/reliability/service";

export async function POST(request: NextRequest) {
  const auth = await authorizeReliabilityRequest(request, {
    allowCronSecret: true,
  });
  if (!auth.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: auth.status });
  }

  const triggeredBy = auth.via === "cron" ? "cron" : "manual";
  const result = await runSnapshotJob(triggeredBy);
  return NextResponse.json({
    triggeredBy,
    snapshotsCreated: result.snapshotsCreated,
    alertsCreated: result.alertsCreated,
  });
}

// Vercel Cron also probes endpoints via GET when scheduled. Accept GET with the
// same auth rules so the cron configuration can be written either way.
export async function GET(request: NextRequest) {
  return POST(request);
}
