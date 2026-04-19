# Distributed Rate Limiting & Admin Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-plan-execution to implement this plan task-by-task.

**Goal:** Replace in-memory rate limiting with Prisma-backed distributed rate limiting, and build an admin dashboard for managing users, access codes, and viewing platform analytics.

**Architecture:** Rate limiting moves to SQLite (Prisma) with a sliding-window counter per IP+endpoint, making it work across serverless instances sharing the same DB. Admin dashboard is a new `/admin` route group protected by role-based middleware that checks `session.role === "admin"`.

**Tech Stack:** Next.js 16 App Router, Prisma + SQLite, shadcn/ui (Button, Sheet, Dialog, DropdownMenu), lucide-react icons, next-intl for i18n, jose JWT sessions.

---

## Session 1: Distributed Rate Limiting
Tasks 1–5: Schema, library, migration, integration, cleanup
Exit criteria: All existing rate-limit tests pass, build succeeds, rate limiting works via DB

## Session 2: Admin Auth Guards
Tasks 6–8: Auth helpers, middleware protection, layout auth fix
Exit criteria: Admin routes only accessible by admin-role users, user sessions recognized by layout

## Session 3: Admin Dashboard Pages
Tasks 9–12: Dashboard page, users list, access codes management, API endpoints
Exit criteria: Admin can view users, access codes, and basic stats

---

## Session 1: Distributed Rate Limiting

### Task 1: Add RateLimit model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the RateLimit model**

Add at the end of `prisma/schema.prisma`:

```prisma
model RateLimit {
  id         String   @id @default(cuid())
  identifier String   // IP or composite key (e.g., "ip:endpoint")
  endpoint   String   @default("default") // e.g., "login", "register"
  count      Int      @default(1)
  resetAt    DateTime // When the sliding window resets

  @@unique([identifier, endpoint])
  @@index([resetAt])
}
```

**Step 2: Run migration**

```bash
bunx prisma migrate dev --name add-rate-limit-model
```

Expected: Migration created and applied successfully.

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add RateLimit model for distributed rate limiting"
```

---

### Task 2: Rewrite rate-limit.ts to use Prisma

**Files:**
- Modify: `src/lib/rate-limit.ts`
- Modify: `src/lib/db.ts` (read-only, verify prisma export)

**Step 1: Rewrite `src/lib/rate-limit.ts`**

Replace entire file with:

```typescript
import { prisma } from "@/lib/db";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Distributed rate limiter using Prisma (SQLite).
 * Works across all instances sharing the same database.
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string = "default",
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  // Periodically clean up expired entries (1% chance per check)
  if (Math.random() < 0.01) {
    await prisma.rateLimit.deleteMany({
      where: { resetAt: { lt: now } },
    });
  }

  const existing = await prisma.rateLimit.findUnique({
    where: {
      identifier_endpoint: { identifier, endpoint },
    },
  });

  // No entry or expired window — start fresh
  if (!existing || existing.resetAt < now) {
    const resetAt = new Date(now.getTime() + WINDOW_MS);
    await prisma.rateLimit.upsert({
      where: {
        identifier_endpoint: { identifier, endpoint },
      },
      create: { identifier, endpoint, count: 1, resetAt },
      update: { count: 1, resetAt },
    });

    return { limited: false, remaining: MAX_ATTEMPTS - 1, resetAt };
  }

  // Active window — increment count
  const newCount = existing.count + 1;
  const limited = newCount > MAX_ATTEMPTS;

  if (!limited) {
    await prisma.rateLimit.update({
      where: {
        identifier_endpoint: { identifier, endpoint },
      },
      data: { count: newCount },
    });
  }

  return {
    limited,
    remaining: Math.max(0, MAX_ATTEMPTS - newCount),
    resetAt: existing.resetAt,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "refactor: replace in-memory rate limiter with Prisma-backed distributed store"
```

---

### Task 3: Update auth routes to use async checkRateLimit

**Files:**
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/register/route.ts`

**Step 1: Update `src/app/api/auth/login/route.ts`**

Replace the `isRateLimited` import and usage:

```typescript
// Old:
import { isRateLimited } from "@/lib/rate-limit";
// ...
if (isRateLimited(ip)) {

// New:
import { checkRateLimit } from "@/lib/rate-limit";
// ...
const { limited, remaining, resetAt } = await checkRateLimit(ip, "login");
if (limited) {
  return NextResponse.json(
    { error: "rate_limited", message: "Too many login attempts. Please try again later." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetAt.toISOString(),
      },
    },
  );
}
```

Also remove the unused `remaining` and `resetAt` from the non-limited path — just destructure `limited` is fine since we don't use them yet.

Actually, keep the full destructuring for the response headers. Update the rate-limited block to:

```typescript
const rateResult = await checkRateLimit(ip, "login");
if (rateResult.limited) {
  return NextResponse.json(
    { error: "rate_limited", message: "Too many login attempts. Please try again later." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": rateResult.resetAt.toISOString(),
      },
    },
  );
}
```

**Step 2: Apply the same pattern to `src/app/api/auth/register/route.ts`**

Replace:
```typescript
// Old:
import { isRateLimited } from "@/lib/rate-limit";
// ...
if (isRateLimited(ip)) {

// New:
import { checkRateLimit } from "@/lib/rate-limit";
// ...
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
```

**Step 3: Run build to verify**

```bash
bun run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 4: Commit**

```bash
git add src/app/api/auth/
git commit -m "refactor: update auth routes to use async distributed rate limiter"
```

---

### Task 4: Update existing rate-limit tests

**Files:**
- Modify: `src/lib/__tests__/rate-limit.test.ts`

**Step 1: Read and update the test file**

The existing tests use `isRateLimited` (sync) and `resetRateLimitStore`. Replace with tests for `checkRateLimit` (async) that use Prisma's test DB. Since the tests likely use mocks, update to mock the Prisma calls.

Read `src/lib/__tests__/rate-limit.test.ts` first, then rewrite:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    rateLimit: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

const mockPrisma = vi.mocked(prisma.rateLimit);

beforeEach(() => {
  vi.clearAllMocks();
  // Suppress random cleanup in tests
  vi.spyOn(Math, "random").mockReturnValue(1);
});

describe("checkRateLimit", () => {
  it("allows first request and creates new entry", async () => {
    mockPrisma.findUnique.mockResolvedValue(null);
    mockPrisma.upsert.mockResolvedValue({} as never);

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(9);
    expect(mockPrisma.upsert).toHaveBeenCalledOnce();
  });

  it("allows requests within limit", async () => {
    const resetAt = new Date(Date.now() + 60000);
    mockPrisma.findUnique.mockResolvedValue({
      id: "1",
      identifier: "192.168.1.1",
      endpoint: "login",
      count: 5,
      resetAt,
    });
    mockPrisma.update.mockResolvedValue({} as never);

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests over limit", async () => {
    const resetAt = new Date(Date.now() + 60000);
    mockPrisma.findUnique.mockResolvedValue({
      id: "1",
      identifier: "192.168.1.1",
      endpoint: "login",
      count: 10,
      resetAt,
    });

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("resets expired windows", async () => {
    const expiredResetAt = new Date(Date.now() - 1000);
    mockPrisma.findUnique.mockResolvedValue({
      id: "1",
      identifier: "192.168.1.1",
      endpoint: "login",
      count: 100,
      resetAt: expiredResetAt,
    });
    mockPrisma.upsert.mockResolvedValue({} as never);

    const result = await checkRateLimit("192.168.1.1", "login");

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(9);
    expect(mockPrisma.upsert).toHaveBeenCalledOnce();
  });

  it("separates endpoints independently", async () => {
    mockPrisma.findUnique.mockResolvedValue(null);
    mockPrisma.upsert.mockResolvedValue({} as never);

    await checkRateLimit("192.168.1.1", "login");
    await checkRateLimit("192.168.1.1", "register");

    // Two different upsert calls for different endpoints
    expect(mockPrisma.upsert).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run tests**

```bash
bun run test -- src/lib/__tests__/rate-limit.test.ts
```

Expected: All 5 tests pass.

**Step 3: Commit**

```bash
git add src/lib/__tests__/rate-limit.test.ts
git commit -m "test: update rate-limit tests for async Prisma-backed implementation"
```

---

### Task 5: Update seed to include RateLimit cleanup

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Add rate limit cleanup to seed**

In the seed file, before the final log, add:

```typescript
// Clean up stale rate limits on seed
await prisma.rateLimit.deleteMany();
```

**Step 2: Run seed to verify**

```bash
bunx prisma db seed
```

Expected: Seeds successfully.

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore: clean rate limits on database seed"
```

---

## Session 2: Admin Auth Guards

### Task 6: Add admin session helpers to auth.ts

**Files:**
- Modify: `src/lib/auth.ts`

**Step 1: Add getUserSession and requireAdmin helpers**

Add after the existing `getChildSession` function:

```typescript
/** Returns session if authenticated as a user (email/password), otherwise null. */
export async function getUserSession(): Promise<{
  userId: string;
  role: string;
} | null> {
  const session = await getSession();
  if (!session || session.type !== "user" || !session.userId || !session.role)
    return null;
  return { userId: session.userId, role: session.role };
}

/** Returns user session if authenticated as admin, otherwise null. */
export async function getAdminSession(): Promise<{
  userId: string;
  role: string;
} | null> {
  const userSession = await getUserSession();
  if (!userSession || userSession.role !== "admin") return null;
  return userSession;
}
```

**Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add getUserSession and getAdminSession helpers"
```

---

### Task 7: Add admin route protection to proxy.ts

**Files:**
- Modify: `src/proxy.ts`

**Step 1: Add admin route protection**

After the existing auth redirect logic (around line 82), add admin route protection:

```typescript
// Admin routes require admin role
if (pathnameWithoutLocale.startsWith("/admin")) {
  if (!isAuthenticated) {
    return NextResponse.redirect(
      new URL(`/${locale}/login`, request.url),
    );
  }
  if (session?.type !== "user" || session?.role !== "admin") {
    return NextResponse.redirect(
      new URL(`/${locale}/dashboard`, request.url),
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/proxy.ts
git commit -m "feat: add admin route protection in proxy middleware"
```

---

### Task 8: Fix layout to recognize user sessions

**Files:**
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/LocaleShell.tsx`

**Step 1: Fix `src/app/[locale]/layout.tsx`**

Change line 23 from:
```typescript
const isAuthenticated = !!session?.childId;
```
to:
```typescript
const isAuthenticated = !!(session?.childId || session?.userId);
const isAdmin = session?.type === "user" && session?.role === "admin";
```

Update the `LocaleShell` props:
```tsx
<LocaleShell isAuthenticated={isAuthenticated} isAdmin={isAdmin}>
  {children}
</LocaleShell>
```

**Step 2: Update `src/components/layout/LocaleShell.tsx`**

Add `isAdmin` to the props type and pass to Header:

```typescript
type LocaleShellProps = {
  children: ReactNode;
  isAuthenticated: boolean;
  isAdmin: boolean;
};

export function LocaleShell({ children, isAuthenticated, isAdmin }: LocaleShellProps) {
```

And update Header usage:
```tsx
<Header isAuthenticated={isAuthenticated} isAdmin={isAdmin} />
```

**Step 3: Update `src/components/layout/Header.tsx`**

Add `isAdmin` to HeaderProps and conditionally show admin link:

```typescript
interface HeaderProps {
  isAuthenticated: boolean;
  isAdmin: boolean;
}
```

Update the component signature:
```typescript
export function Header({ isAuthenticated, isAdmin }: HeaderProps) {
```

Add admin link in NAV_LINKS section (after the nav links map, before the auth button). In both desktop and mobile nav, add:

```tsx
{isAdmin && (
  <Link
    href="/admin"
    className={cn(navLinkClass, pathname.startsWith("/admin") && "bg-zinc-100")}
  >
    {tNav("admin")}
  </Link>
)}
```

**Step 4: Add i18n keys**

In `messages/en.json`, add to `nav`:
```json
"admin": "Admin"
```

In `messages/id.json`, add to `nav`:
```json
"admin": "Admin"
```

In `messages/zh.json`, add to `nav`:
```json
"admin": "管理"
```

**Step 5: Run build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/app/[locale]/layout.tsx src/components/layout/Header.tsx src/components/layout/LocaleShell.tsx messages/
git commit -m "feat: recognize user sessions in layout, add admin nav link for admin users"
```

---

## Session 3: Admin Dashboard Pages

### Task 9: Add admin i18n translations

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/id.json`
- Modify: `messages/zh.json`

**Step 1: Add admin translations to `messages/en.json`**

Add a new top-level `"admin"` section:

```json
"admin": {
  "title": "Admin Dashboard",
  "subtitle": "Manage your platform",
  "stats": {
    "totalUsers": "Total Users",
    "totalChildren": "Children",
    "activeCodes": "Active Codes",
    "totalDiscoveries": "Discoveries",
    "totalQuests": "Quests",
    "totalGalleryEntries": "Gallery Entries"
  },
  "tabs": {
    "overview": "Overview",
    "users": "Users",
    "codes": "Access Codes"
  },
  "users": {
    "title": "Users",
    "email": "Email",
    "name": "Name",
    "role": "Role",
    "createdAt": "Joined",
    "noUsers": "No users found.",
    "roleAdmin": "Admin",
    "roleUser": "User",
    "roleAi": "AI Agent"
  },
  "codes": {
    "title": "Access Codes",
    "code": "Code",
    "status": "Status",
    "expiresAt": "Expires",
    "children": "Children",
    "active": "Active",
    "inactive": "Inactive",
    "noExpiry": "Never",
    "noCodes": "No access codes found.",
    "createButton": "Create Code",
    "createTitle": "Create Access Code",
    "codeLabel": "Code",
    "codePlaceholder": "Leave blank to auto-generate",
    "expiresLabel": "Expires At (optional)",
    "cancel": "Cancel",
    "create": "Create",
    "created": "Access code created successfully",
    "createError": "Failed to create access code"
  },
  "forbidden": {
    "title": "Access Denied",
    "description": "You don't have permission to access this page.",
    "backHome": "Go to Dashboard"
  }
}
```

**Step 2: Add equivalent translations to `messages/id.json`**

```json
"admin": {
  "title": "Dashboard Admin",
  "subtitle": "Kelola platform Anda",
  "stats": {
    "totalUsers": "Total Pengguna",
    "totalChildren": "Anak",
    "activeCodes": "Kode Aktif",
    "totalDiscoveries": "Penemuan",
    "totalQuests": "Misi",
    "totalGalleryEntries": "Entri Galeri"
  },
  "tabs": {
    "overview": "Ringkasan",
    "users": "Pengguna",
    "codes": "Kode Akses"
  },
  "users": {
    "title": "Pengguna",
    "email": "Email",
    "name": "Nama",
    "role": "Peran",
    "createdAt": "Bergabung",
    "noUsers": "Tidak ada pengguna.",
    "roleAdmin": "Admin",
    "roleUser": "Pengguna",
    "roleAi": "Agen AI"
  },
  "codes": {
    "title": "Kode Akses",
    "code": "Kode",
    "status": "Status",
    "expiresAt": "Kedaluwarsa",
    "children": "Anak",
    "active": "Aktif",
    "inactive": "Tidak Aktif",
    "noExpiry": "Tidak Pernah",
    "noCodes": "Tidak ada kode akses.",
    "createButton": "Buat Kode",
    "createTitle": "Buat Kode Akses",
    "codeLabel": "Kode",
    "codePlaceholder": "Kosongkan untuk otomatis",
    "expiresLabel": "Kedaluwarsa pada (opsional)",
    "cancel": "Batal",
    "create": "Buat",
    "created": "Kode akses berhasil dibuat",
    "createError": "Gagal membuat kode akses"
  },
  "forbidden": {
    "title": "Akses Ditolak",
    "description": "Anda tidak memiliki izin untuk mengakses halaman ini.",
    "backHome": "Ke Dashboard"
  }
}
```

**Step 3: Add equivalent translations to `messages/zh.json`**

```json
"admin": {
  "title": "管理仪表板",
  "subtitle": "管理您的平台",
  "stats": {
    "totalUsers": "用户总数",
    "totalChildren": "儿童",
    "activeCodes": "活跃代码",
    "totalDiscoveries": "发现",
    "totalQuests": "任务",
    "totalGalleryEntries": "画廊作品"
  },
  "tabs": {
    "overview": "概览",
    "users": "用户",
    "codes": "访问代码"
  },
  "users": {
    "title": "用户",
    "email": "邮箱",
    "name": "姓名",
    "role": "角色",
    "createdAt": "加入时间",
    "noUsers": "暂无用户。",
    "roleAdmin": "管理员",
    "roleUser": "用户",
    "roleAi": "AI 代理"
  },
  "codes": {
    "title": "访问代码",
    "code": "代码",
    "status": "状态",
    "expiresAt": "过期时间",
    "children": "儿童",
    "active": "活跃",
    "inactive": "未激活",
    "noExpiry": "永不过期",
    "noCodes": "暂无访问代码。",
    "createButton": "创建代码",
    "createTitle": "创建访问代码",
    "codeLabel": "代码",
    "codePlaceholder": "留空以自动生成",
    "expiresLabel": "过期时间（可选）",
    "cancel": "取消",
    "create": "创建",
    "created": "访问代码创建成功",
    "createError": "创建访问代码失败"
  },
  "forbidden": {
    "title": "访问被拒绝",
    "description": "您没有权限访问此页面。",
    "backHome": "返回仪表板"
  }
}
```

**Step 4: Commit**

```bash
git add messages/
git commit -m "feat: add admin dashboard i18n translations for en, id, zh"
```

---

### Task 10: Create admin API endpoints

**Files:**
- Create: `src/app/api/admin/stats/route.ts`
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/codes/route.ts`

**Step 1: Create `src/app/api/admin/stats/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [
    totalUsers,
    totalChildren,
    activeCodes,
    totalDiscoveries,
    totalQuests,
    totalGalleryEntries,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.child.count(),
    prisma.accessCode.count({ where: { active: true } }),
    prisma.discovery.count(),
    prisma.quest.count(),
    prisma.galleryEntry.count(),
  ]);

  return NextResponse.json({
    totalUsers,
    totalChildren,
    activeCodes,
    totalDiscoveries,
    totalQuests,
    totalGalleryEntries,
  });
}
```

**Step 2: Create `src/app/api/admin/users/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count(),
  ]);

  return NextResponse.json({ users, total, page, limit });
}
```

**Step 3: Create `src/app/api/admin/codes/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const skip = (page - 1) * limit;

  const [codes, total] = await Promise.all([
    prisma.accessCode.findMany({
      select: {
        id: true,
        code: true,
        active: true,
        expiresAt: true,
        createdAt: true,
        _count: { select: { children: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.accessCode.count(),
  ]);

  return NextResponse.json({ codes, total, page, limit });
}

const CreateCodeSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const parsed = CreateCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.issues }, { status: 400 });
  }

  const code = parsed.data.code ?? generateCode();

  // Check uniqueness
  if (parsed.data.code) {
    const existing = await prisma.accessCode.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "code_exists" }, { status: 409 });
    }
  }

  const accessCode = await prisma.accessCode.create({
    data: {
      code,
      active: true,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
    select: { id: true, code: true, active: true, expiresAt: true, createdAt: true },
  });

  return NextResponse.json(accessCode, { status: 201 });
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
  );
  return segments.join("-");
}
```

**Step 4: Commit**

```bash
git add src/app/api/admin/
git commit -m "feat: add admin API endpoints for stats, users, and access codes"
```

---

### Task 11: Create admin dashboard page

**Files:**
- Create: `src/app/[locale]/admin/page.tsx`
- Create: `src/app/[locale]/admin/layout.tsx`

**Step 1: Create `src/app/[locale]/admin/layout.tsx`**

```tsx
import { getAdminSession } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const admin = await getAdminSession();
  if (!admin) {
    redirect({ href: "/dashboard", locale });
  }

  return <>{children}</>;
}
```

**Step 2: Create `src/app/[locale]/admin/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { Users, Shield, Ticket, Sparkles, Swords, Image } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface StatsData {
  totalUsers: number;
  totalChildren: number;
  activeCodes: number;
  totalDiscoveries: number;
  totalQuests: number;
  totalGalleryEntries: number;
}

async function getStats(): Promise<StatsData> {
  const [totalUsers, totalChildren, activeCodes, totalDiscoveries, totalQuests, totalGalleryEntries] =
    await Promise.all([
      prisma.user.count(),
      prisma.child.count(),
      prisma.accessCode.count({ where: { active: true } }),
      prisma.discovery.count(),
      prisma.quest.count(),
      prisma.galleryEntry.count(),
    ]);
  return { totalUsers, totalChildren, activeCodes, totalDiscoveries, totalQuests, totalGalleryEntries };
}

export default async function AdminDashboardPage() {
  const t = getTranslations("admin");
  const stats = await getStats();

  const statCards = [
    { key: "totalUsers", value: stats.totalUsers, icon: Users, color: "text-blue-600" },
    { key: "totalChildren", value: stats.totalChildren, icon: Shield, color: "text-green-600" },
    { key: "activeCodes", value: stats.activeCodes, icon: Ticket, color: "text-purple-600" },
    { key: "totalDiscoveries", value: stats.totalDiscoveries, icon: Sparkles, color: "text-amber-600" },
    { key: "totalQuests", value: stats.totalQuests, icon: Swords, color: "text-rose-600" },
    { key: "totalGalleryEntries", value: stats.totalGalleryEntries, icon: Image, color: "text-cyan-600" },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map(({ key, value, icon: Icon, color }) => (
          <div
            key={key}
            className="rounded-xl border border-border/60 bg-background p-4"
          >
            <div className="flex items-center gap-2">
              <Icon className={`size-4 ${color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{t(`stats.${key}`)}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/users"
          className="rounded-xl border border-border/60 bg-background p-6 transition-colors hover:bg-zinc-50"
        >
          <h2 className="font-semibold text-foreground">{t("tabs.users")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.totalUsers} {t("stats.totalUsers").toLowerCase()}
          </p>
        </Link>
        <Link
          href="/admin/codes"
          className="rounded-xl border border-border/60 bg-background p-6 transition-colors hover:bg-zinc-50"
        >
          <h2 className="font-semibold text-foreground">{t("tabs.codes")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.activeCodes} {t("stats.activeCodes").toLowerCase()}
          </p>
        </Link>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/[locale]/admin/
git commit -m "feat: add admin dashboard page with stats overview"
```

---

### Task 12: Create admin users and codes pages

**Files:**
- Create: `src/app/[locale]/admin/users/page.tsx`
- Create: `src/app/[locale]/admin/codes/page.tsx`

**Step 1: Create `src/app/[locale]/admin/users/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { BackButton } from "@/components/layout/BackButton";

export default async function AdminUsersPage() {
  const t = getTranslations("admin.users");
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return t("roleAdmin");
      case "ai": return t("roleAi");
      default: return t("roleUser");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <BackButton />
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      </div>

      {users.length === 0 ? (
        <p className="text-muted-foreground">{t("noUsers")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-zinc-50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("name")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("email")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("role")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("createdAt")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 text-foreground">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-foreground">
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {user.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create `src/app/[locale]/admin/codes/page.tsx`**

```tsx
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { BackButton } from "@/components/layout/BackButton";
import { CreateCodeButton } from "./CreateCodeButton";

export default async function AdminCodesPage() {
  const t = getTranslations("admin.codes");
  const codes = await prisma.accessCode.findMany({
    select: {
      id: true,
      code: true,
      active: true,
      expiresAt: true,
      createdAt: true,
      _count: { select: { children: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        </div>
        <CreateCodeButton />
      </div>

      {codes.length === 0 ? (
        <p className="text-muted-foreground">{t("noCodes")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-zinc-50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("code")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("status")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("children")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("expiresAt")}</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((ac) => (
                <tr key={ac.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-mono text-sm text-foreground">{ac.code}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      ac.active
                        ? "bg-green-50 text-green-700"
                        : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {ac.active ? t("active") : t("inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ac._count.children}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ac.expiresAt ? ac.expiresAt.toLocaleDateString() : t("noExpiry")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create `src/app/[locale]/admin/codes/CreateCodeButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateCodeButton() {
  const t = useTranslations("admin.codes");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    try {
      const code = (formData.get("code") as string)?.trim() || undefined;
      const expiresAt = (formData.get("expiresAt") as string) || undefined;

      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, expiresAt }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error === "code_exists" ? "Code already exists" : t("createError"));
        return;
      }

      setOpen(false);
      window.location.reload();
    } catch {
      setError(t("createError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          {t("createButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="code" className="text-sm font-medium text-foreground">
              {t("codeLabel")}
            </label>
            <input
              id="code"
              name="code"
              placeholder={t("codePlaceholder")}
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="expiresAt" className="text-sm font-medium text-foreground">
              {t("expiresLabel")}
            </label>
            <input
              id="expiresAt"
              name="expiresAt"
              type="datetime-local"
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "..." : t("create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Create `src/components/layout/BackButton.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => router.back()}
      aria-label="Go back"
      className="shrink-0"
    >
      <ArrowLeft className="size-4" />
    </Button>
  );
}
```

**Step 5: Add breadcrumb keys for admin**

In `messages/en.json` breadcrumb section, add:
```json
"admin": "Admin",
"users": "Users",
"codes": "Access Codes"
```

Same for `messages/id.json`:
```json
"admin": "Admin",
"users": "Pengguna",
"codes": "Kode Akses"
```

And `messages/zh.json`:
```json
"admin": "管理",
"users": "用户",
"codes": "访问代码"
```

**Step 6: Run build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 7: Commit**

```bash
git add src/app/[locale]/admin/ src/components/layout/BackButton.tsx messages/
git commit -m "feat: add admin users and codes management pages with create code dialog"
```

---

## Summary

| Session | Tasks | What's Built |
|---------|-------|-------------|
| 1 | 1–5 | Distributed rate limiting via Prisma (replaces in-memory) |
| 2 | 6–8 | Admin auth guards, middleware protection, layout session fix |
| 3 | 9–12 | Admin dashboard with stats, users table, access codes with create dialog |

**Total new files:** 8
**Total modified files:** 12
**Estimated tasks:** 12
