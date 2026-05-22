import { NextRequest, NextResponse } from "next/server";
import { authorizeReliabilityRequest } from "@/lib/reliability/auth";
import { acknowledgeAlert } from "@/lib/reliability/repository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeReliabilityRequest(request);
  if (!auth.ok || auth.via !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  try {
    await acknowledgeAlert(id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "ack_failed", message: (error as Error).message },
      { status: 400 },
    );
  }
}
