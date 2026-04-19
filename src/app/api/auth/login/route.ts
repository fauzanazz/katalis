import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createChildSession, createUserSession } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";
import { sanitizeInput, isValidAccessCodeFormat } from "@/lib/sanitize";
import { verifyPassword } from "@/lib/password";
import { routing } from "@/i18n/routing";

const AccessCodeSchema = z.object({
  code: z.string().min(1, "Access code is required"),
});

const EmailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    // Determine login method by presence of "email" field
    if (body.email) {
      return handleEmailLogin(body);
    }

    return handleAccessCodeLogin(body);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "internal", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

async function handleEmailLogin(body: Record<string, unknown>) {
  const parsed = EmailLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", message: "Invalid email or password" },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, passwordHash: true, role: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: "invalid", message: "Invalid email or password" },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "invalid", message: "Invalid email or password" },
      { status: 401 },
    );
  }

  await createUserSession(user.id, user.role);

  return NextResponse.json(
    { success: true, userId: user.id, name: user.name },
    { status: 200 },
  );
}

async function handleAccessCodeLogin(body: Record<string, unknown>) {
  const parsed = AccessCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", message: "Access code is required" },
      { status: 400 },
    );
  }

  const rawCode = parsed.data.code;
  const code = sanitizeInput(rawCode);

  if (!isValidAccessCodeFormat(code)) {
    return NextResponse.json(
      { error: "invalid", message: "Invalid access code format" },
      { status: 400 },
    );
  }

  const accessCode = await prisma.accessCode.findUnique({
    where: { code },
  });

  if (!accessCode) {
    return NextResponse.json(
      { error: "invalid", message: "Access code is not valid" },
      { status: 401 },
    );
  }

  if (!accessCode.active) {
    return NextResponse.json(
      { error: "invalid", message: "Access code is not valid" },
      { status: 401 },
    );
  }

  if (accessCode.expiresAt && new Date() > accessCode.expiresAt) {
    return NextResponse.json(
      { error: "expired", message: "This access code has expired" },
      { status: 401 },
    );
  }

  let child = await prisma.child.findFirst({
    where: { accessCodeId: accessCode.id },
  });

  if (!child) {
    child = await prisma.child.create({
      data: {
        accessCodeId: accessCode.id,
        locale: routing.defaultLocale,
      },
    });
  }

  await createChildSession(child.id);

  return NextResponse.json(
    { success: true, childId: child.id },
    { status: 200 },
  );
}
