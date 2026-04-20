import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth";
import { verifyParentChildLink } from "@/lib/parent/link";
import {
  generateParentReport,
  getReportsForChild,
} from "@/lib/parent/report-generator";
import { GenerateReportSchema } from "@/lib/parent/schemas";

export async function GET(request: NextRequest | Request) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const childId = url.searchParams.get("childId");
    if (!childId) {
      return NextResponse.json(
        { error: "invalid", message: "childId query parameter is required" },
        { status: 400 },
      );
    }

    const isLinked = await verifyParentChildLink(session.userId, childId);
    if (!isLinked) {
      return NextResponse.json(
        { error: "forbidden", message: "You are not linked to this child" },
        { status: 403 },
      );
    }

    const reports = await getReportsForChild(childId, session.userId);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Parent reports fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch reports" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest | Request) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = GenerateReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
        },
        { status: 400 },
      );
    }

    const { childId, type } = parsed.data;

    const isLinked = await verifyParentChildLink(session.userId, childId);
    if (!isLinked) {
      return NextResponse.json(
        { error: "forbidden", message: "You are not linked to this child" },
        { status: 403 },
      );
    }

    const report = await generateParentReport({
      parentId: session.userId,
      childId,
      type,
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error("Parent report generation error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to generate report" },
      { status: 500 },
    );
  }
}
