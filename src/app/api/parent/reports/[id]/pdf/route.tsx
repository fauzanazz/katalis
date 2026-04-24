import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ParentReportPDF } from "@/lib/parent/pdf-template";

/**
 * GET /api/parent/reports/[id]/pdf
 *
 * Generate and download a PDF of a parent report.
 * Requires parent authentication and ownership verification.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const { id } = await params;

    const report = await prisma.parentReport.findUnique({
      where: { id },
      include: {
        child: { select: { name: true } },
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: "not_found", message: "Report not found" },
        { status: 404 },
      );
    }

    if (report.parentId !== session.userId) {
      return NextResponse.json(
        { error: "forbidden", message: "Not authorized to view this report" },
        { status: 403 },
      );
    }

    const period = report.period ? JSON.parse(report.period) : {};
    const strengths = report.strengths ? JSON.parse(report.strengths) : [];
    const growthAreas = report.growthAreas ? JSON.parse(report.growthAreas) : [];
    const tips = report.tips ? JSON.parse(report.tips) : [];
    const badgeHighlights = report.badgeHighlights
      ? JSON.parse(report.badgeHighlights)
      : [];

    const startDate = period.start
      ? new Date(period.start).toLocaleDateString()
      : "";
    const endDate = period.end
      ? new Date(period.end).toLocaleDateString()
      : "";

    const data = {
      childName: report.child.name ?? "Your Child",
      period: `${startDate} - ${endDate}`,
      type: report.type,
      generatedAt: report.createdAt.toLocaleDateString(),
      summary: report.summary ?? "",
      strengths,
      growthAreas,
      tips,
      badgeHighlights,
    };

    const pdfBuffer = await renderToBuffer(<ParentReportPDF data={data} />);

    const filename = `katalis-report-${(report.child.name ?? "child").toLowerCase().replace(/\s+/g, "-")}-${report.type}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}
