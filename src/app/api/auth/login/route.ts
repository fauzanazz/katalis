import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";
import { sanitizeInput, isValidAccessCodeFormat } from "@/lib/sanitize";

const LoginSchema = z.object({
  code: z.string().min(1, "Access code is required"),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many login attempts. Please try again later." },
        { status: 429 },
      );
    }

    // Parse and validate request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid", message: "Access code is required" },
        { status: 400 },
      );
    }

    // Sanitize input
    const rawCode = parsed.data.code;
    const code = sanitizeInput(rawCode);

    // Check for suspicious patterns (XSS/injection attempts)
    if (!isValidAccessCodeFormat(code)) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid access code format" },
        { status: 400 },
      );
    }

    // Look up access code in database using Prisma (safe from SQL injection)
    const accessCode = await prisma.accessCode.findUnique({
      where: { code },
    });

    if (!accessCode) {
      return NextResponse.json(
        { error: "invalid", message: "Access code is not valid" },
        { status: 401 },
      );
    }

    // Check if code is active
    if (!accessCode.active) {
      return NextResponse.json(
        { error: "invalid", message: "Access code is not valid" },
        { status: 401 },
      );
    }

    // Check if code is expired
    if (accessCode.expiresAt && new Date() > accessCode.expiresAt) {
      return NextResponse.json(
        { error: "expired", message: "This access code has expired" },
        { status: 401 },
      );
    }

    // Find or create a child record for this access code
    let child = await prisma.child.findFirst({
      where: { accessCodeId: accessCode.id },
    });

    if (!child) {
      child = await prisma.child.create({
        data: {
          accessCodeId: accessCode.id,
          locale: "id",
        },
      });
    }

    // Create session
    await createSession(child.id);

    return NextResponse.json(
      { success: true, childId: child.id },
      { status: 200 },
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "internal", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
