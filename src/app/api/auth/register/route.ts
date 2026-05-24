import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { hashPassword } from "@/lib/password";
import { createUserSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateResult = await checkRateLimit(ip, "register");
    if (rateResult.limited) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateResult.resetAt.toISOString(),
          },
        },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid", message: "Invalid request body" },
        { status: 400 },
      );
    }

    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: "validation",
          message: firstError?.message ?? "Invalid input",
        },
        { status: 400 },
      );
    }

    const { name, email, password } = parsed.data;

    const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existingUser) {
      return NextResponse.json(
        { error: "email_exists", message: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    const user = (
      await db
        .insert(users)
        .values({ email, name, passwordHash, role: "user" })
        .returning({ id: users.id, name: users.name, role: users.role })
    )[0];

    await createUserSession(user.id, user.role);

    return NextResponse.json(
      { success: true, userId: user.id, name: user.name },
      { status: 201 },
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "internal", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
