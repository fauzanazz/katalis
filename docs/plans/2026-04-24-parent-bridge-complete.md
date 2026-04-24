# Parent Bridge Complete — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-plan-execution to implement this plan task-by-task.

**Goal:** Complete the Parent Bridge module with downloadable PDF reports, a browsable mentoring tips library, and structured parent guidance workflows.

**Current State:**
- `ParentReport` model exists with AI-generated content
- `ReportView` component renders reports on screen only
- `home-tips.ts` has 13 static tips but no public-facing library
- No parent guidance workflows exist

**Architecture:** Add PDF export via `@react-pdf/renderer`. Create tips library page with category filtering. Add parent guidance workflow state for following along with child's quest.

**Tech Stack:** @react-pdf/renderer (PDF), Prisma, shadcn Tabs/Accordion, lucide-react, next-intl

---

## Session 1: PDF Report Export (Tasks 1-5)

Exit criteria: Parent can download report as PDF, build passes

### Task 1: Install PDF Dependencies

**Step 1: Install @react-pdf/renderer**

```bash
bun add @react-pdf/renderer
```

Note: @react-pdf/renderer works on the server in Next.js. We'll create a server action or API route to generate PDFs.

**Step 2: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: add @react-pdf/renderer for PDF exports"
```

---

### Task 2: Create PDF Report Template Component

**Files:**
- Create: `src/lib/parent/pdf-template.tsx`

**Step 1: Create the PDF document template**

```typescript
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#f59e0b",
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#f59e0b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: "#fefce8",
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  cardText: {
    fontSize: 10,
    color: "#4b5563",
    lineHeight: 1.5,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    backgroundColor: "#fef3c7",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    fontSize: 10,
  },
  tipCard: {
    backgroundColor: "#f0fdf4",
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#22c55e",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    color: "#9ca3af",
    textAlign: "center",
  },
});

interface ReportData {
  childName: string;
  period: string;
  generatedAt: string;
  summary: string;
  strengths: Array<{ title: string; description: string }>;
  growthAreas: Array<{ title: string; description: string }>;
  tips: Array<{ title: string; description: string }>;
  badgeHighlights: string[];
}

export function ParentReportPDF({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Katalis Progress Report</Text>
          <Text style={styles.subtitle}>
            {data.childName} • {data.period}
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>{data.summary}</Text>
          </View>
        </View>

        {/* Strengths */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strengths Discovered</Text>
          {data.strengths.map((strength, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.cardTitle}>{strength.title}</Text>
              <Text style={styles.cardText}>{strength.description}</Text>
            </View>
          ))}
        </View>

        {/* Growth Areas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Growth Opportunities</Text>
          {data.growthAreas.map((area, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.cardTitle}>{area.title}</Text>
              <Text style={styles.cardText}>{area.description}</Text>
            </View>
          ))}
        </View>

        {/* Badges */}
        {data.badgeHighlights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges Earned</Text>
            <View style={styles.badgeRow}>
              {data.badgeHighlights.map((badge, i) => (
                <Text key={i} style={styles.badge}>
                  {badge}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips for Parents</Text>
          {data.tips.map((tip, i) => (
            <View key={i} style={styles.tipCard}>
              <Text style={styles.cardTitle}>{tip.title}</Text>
              <Text style={styles.cardText}>{tip.description}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generated on {data.generatedAt} • Katalis AI
        </Text>
      </Page>
    </Document>
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/parent/pdf-template.tsx
git commit -m "feat: add PDF report template component"
```

---

### Task 3: Create PDF Generation API Route

**Files:**
- Create: `src/app/api/parent/reports/[id]/pdf/route.ts`

**Step 1: Create the PDF route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getParentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ParentReportPDF } from "@/lib/parent/pdf-template";

/**
 * GET /api/parent/reports/[id]/pdf
 * 
 * Generate and download a PDF of a parent report.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getParentSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Parent authentication required" },
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

    // Verify parent owns this child
    const parentChild = await prisma.parentChild.findFirst({
      where: {
        parentId: session.userId,
        childId: report.childId,
      },
    });

    if (!parentChild) {
      return NextResponse.json(
        { error: "forbidden", message: "Not authorized to view this report" },
        { status: 403 },
      );
    }

    // Parse JSON fields
    const period = report.period ? JSON.parse(report.period) : {};
    const strengths = report.strengths ? JSON.parse(report.strengths) : [];
    const growthAreas = report.growthAreas ? JSON.parse(report.growthAreas) : [];
    const tips = report.tips ? JSON.parse(report.tips) : [];
    const badgeHighlights = report.badgeHighlights
      ? JSON.parse(report.badgeHighlights)
      : [];

    const data = {
      childName: report.child.name,
      period: `${period.startDate ?? ""} - ${period.endDate ?? ""}`,
      generatedAt: report.createdAt.toLocaleDateString(),
      summary: report.summary ?? "",
      strengths,
      growthAreas,
      tips,
      badgeHighlights,
    };

    const pdfBuffer = await renderToBuffer(<ParentReportPDF data={data} />);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="katalis-report-${report.child.name}-${report.type}.pdf"`,
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
```

**Step 2: Commit**

```bash
git add src/app/api/parent/reports/[id]/pdf/route.ts
git commit -m "feat: add PDF generation API route for parent reports"
```

---

### Task 4: Add Download Button to ReportView

**Files:**
- Modify: `src/components/parent/ReportView.tsx`

**Step 1: Add download PDF button**

Add import:
```typescript
import { Download } from "lucide-react";
```

Add button near the report header:
```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => window.open(`/api/parent/reports/${report.id}/pdf`, "_blank")}
  className="gap-1.5"
>
  <Download className="size-4" />
  {t("downloadPdf")}
</Button>
```

**Step 2: Commit**

```bash
git add src/components/parent/ReportView.tsx
git commit -m "feat: add PDF download button to ReportView"
```

---

### Task 5: Add i18n for PDF Export

**Files:**
- Modify: `messages/en.json`, `messages/id.json`, `messages/zh.json`

**Step 1: Add translations**

In `parent` or `reports` section:

**en.json:**
```json
"downloadPdf": "Download PDF",
"pdfGenerating": "Generating PDF..."
```

**id.json:**
```json
"downloadPdf": "Unduh PDF",
"pdfGenerating": "Membuat PDF..."
```

**zh.json:**
```json
"downloadPdf": "下载PDF",
"pdfGenerating": "正在生成PDF..."
```

**Step 2: Commit**

```bash
git add messages/
git commit -m "feat: add PDF download i18n (en/id/zh)"
```

---

## Session 2: Tips Library Page (Tasks 6-9)

Exit criteria: Parent can browse tips by category, tips page accessible

### Task 6: Create Tips API Route

**Files:**
- Create: `src/app/api/parent/tips/route.ts`

**Step 1: Create the tips endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getParentSession } from "@/lib/auth";
import { HOME_TIPS, TIP_CATEGORIES } from "@/lib/parent/home-tips";

/**
 * GET /api/parent/tips
 * 
 * Get all parenting tips, optionally filtered by category.
 * Query params: category (optional)
 */
export async function GET(request: NextRequest) {
  const session = await getParentSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized", message: "Parent authentication required" },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const categoryFilter = url.searchParams.get("category");

    let tips = [...HOME_TIPS];
    
    if (categoryFilter && categoryFilter !== "all") {
      tips = tips.filter((tip) => tip.category === categoryFilter);
    }

    return NextResponse.json({
      tips,
      categories: TIP_CATEGORIES,
    });
  } catch (error) {
    console.error("Tips fetch error:", error);
    return NextResponse.json(
      { error: "server_error", message: "Failed to fetch tips" },
      { status: 500 },
    );
  }
}
```

**Step 2: Update home-tips.ts to export categories**

Add to `src/lib/parent/home-tips.ts`:
```typescript
export const TIP_CATEGORIES = [
  { slug: "all", label: "All Tips" },
  { slug: "engineering", label: "Engineering" },
  { slug: "art", label: "Art & Design" },
  { slug: "narrative", label: "Storytelling" },
  { slug: "music", label: "Music" },
  { slug: "science", label: "Science" },
  { slug: "creative", label: "Creative" },
] as const;
```

**Step 3: Commit**

```bash
git add src/app/api/parent/tips/route.ts src/lib/parent/home-tips.ts
git commit -m "feat: add tips API with category filtering"
```

---

### Task 7: Create Tips Library Page

**Files:**
- Create: `src/app/[locale]/parent/tips/page.tsx`

**Step 1: Create the tips page**

```typescript
import { getTranslations } from "next-intl/server";
import { getParentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HOME_TIPS, TIP_CATEGORIES } from "@/lib/parent/home-tips";
import { Lightbulb, Home, Palette, Music, Microscope, Wrench, BookOpen } from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  all: Lightbulb,
  engineering: Wrench,
  art: Palette,
  narrative: BookOpen,
  music: Music,
  science: Microscope,
  creative: Lightbulb,
};

export default async function ParentTipsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await getParentSession();
  if (!session) redirect("/login");

  const t = await getTranslations("parent.tips");
  const params = await searchParams;
  const activeCategory = params.category ?? "all";

  const tips =
    activeCategory === "all"
      ? HOME_TIPS
      : HOME_TIPS.filter((tip) => tip.category === activeCategory);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* Category filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TIP_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.slug] ?? Lightbulb;
          const isActive = activeCategory === cat.slug;
          return (
            <a
              key={cat.slug}
              href={`/parent/tips${cat.slug === "all" ? "" : `?category=${cat.slug}`}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="size-4" />
              {cat.label}
            </a>
          );
        })}
      </div>

      {/* Tips grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {tips.map((tip, i) => (
          <article
            key={i}
            className="rounded-xl border border-border/60 bg-background p-5 transition-shadow hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">{tip.icon ?? "💡"}</span>
              <h3 className="font-semibold text-foreground">{tip.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{tip.description}</p>
            {tip.materials && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tip.materials.map((m, j) => (
                  <span
                    key={j}
                    className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      {tips.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          {t("noTips")}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/[locale]/parent/tips/page.tsx
git commit -m "feat: add parent tips library page with category filters"
```

---

### Task 8: Update home-tips.ts with More Tips

**Files:**
- Modify: `src/lib/parent/home-tips.ts`

**Step 1: Expand the tips library**

Add more tips to reach ~20-25 total across categories. Each tip should have:
- `title`: Short actionable title
- `description`: 1-2 sentences on how to do it
- `category`: One of the category slugs
- `materials`: Optional array of materials needed
- `icon`: Optional emoji

Example additions:
```typescript
{
  title: "Kitchen Science Experiments",
  description: "Use baking soda and vinegar to explore chemical reactions together. Ask your child to predict what will happen.",
  category: "science",
  materials: ["Baking soda", "Vinegar", "Food coloring"],
  icon: "🧪",
},
{
  title: "Build a Cardboard City",
  description: "Collect boxes and let your child design buildings, roads, and parks. Great for spatial thinking.",
  category: "engineering",
  materials: ["Cardboard boxes", "Tape", "Markers"],
  icon: "🏙️",
},
```

**Step 2: Commit**

```bash
git add src/lib/parent/home-tips.ts
git commit -m "feat: expand home tips library to 25+ tips"
```

---

### Task 9: Add Tips i18n

**Files:**
- Modify: `messages/en.json`, `messages/id.json`, `messages/zh.json`

**Step 1: Add translations**

Add `parent.tips` section:

**en.json:**
```json
"tips": {
  "title": "Parenting Tips Library",
  "subtitle": "Activities and ideas to nurture your child's talents at home",
  "noTips": "No tips found for this category",
  "materials": "Materials needed"
}
```

**id.json:**
```json
"tips": {
  "title": "Perpustakaan Tips Orang Tua",
  "subtitle": "Aktivitas dan ide untuk mengembangkan bakat anak di rumah",
  "noTips": "Tidak ada tips untuk kategori ini",
  "materials": "Bahan yang diperlukan"
}
```

**zh.json:**
```json
"tips": {
  "title": "育儿技巧库",
  "subtitle": "在家培养孩子才能的活动和想法",
  "noTips": "此类别没有技巧",
  "materials": "所需材料"
}
```

**Step 2: Commit**

```bash
git add messages/
git commit -m "feat: add tips library i18n (en/id/zh)"
```

---

## Session 3: Parent Guidance Workflow (Tasks 10-13)

Exit criteria: Parent can "follow along" with child's quest, receive daily tips

### Task 10: Add ParentQuestFollow Model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add model for parent following a quest**

```prisma
model ParentQuestFollow {
  id            String   @id @default(cuid())
  parentId      String
  childId       String
  questId       String
  currentDay    Int      @default(1)
  lastViewedAt  DateTime @default(now())
  notifications Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  parent Parent @relation(fields: [parentId], references: [id])
  child  Child  @relation(fields: [childId], references: [id])
  quest  Quest  @relation(fields: [questId], references: [id])

  @@unique([parentId, questId])
  @@index([parentId])
  @@index([questId])
}
```

Add relations to Parent, Child, and Quest models:
```prisma
// In Parent:
questFollows ParentQuestFollow[]

// In Child:
parentQuestFollows ParentQuestFollow[]

// In Quest:
parentFollows ParentQuestFollow[]
```

**Step 2: Run migration**

```bash
bunx prisma migrate dev --name add_parent_quest_follow
```

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add ParentQuestFollow model for guidance workflow"
```

---

### Task 11: Create Parent Quest Follow API

**Files:**
- Create: `src/app/api/parent/follow/route.ts`
- Create: `src/app/api/parent/follow/[questId]/route.ts`

**Step 1: Create follow/unfollow endpoints**

`src/app/api/parent/follow/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { getParentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/parent/follow — Get all quests parent is following
 */
export async function GET() {
  const session = await getParentSession();
  if (!session) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 },
    );
  }

  const follows = await prisma.parentQuestFollow.findMany({
    where: { parentId: session.userId },
    include: {
      quest: {
        select: {
          id: true,
          dream: true,
          status: true,
          missions: {
            select: { day: true, status: true },
            orderBy: { day: "asc" },
          },
        },
      },
      child: {
        select: { id: true, name: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ follows });
}
```

`src/app/api/parent/follow/[questId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getParentSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/parent/follow/[questId] — Start following a quest
 * DELETE /api/parent/follow/[questId] — Stop following a quest
 * PATCH /api/parent/follow/[questId] — Update follow settings (currentDay viewed)
 */

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  const session = await getParentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { questId } = await params;

  // Verify quest belongs to one of parent's children
  const quest = await prisma.quest.findUnique({
    where: { id: questId },
    include: { child: true },
  });

  if (!quest) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const parentChild = await prisma.parentChild.findFirst({
    where: { parentId: session.userId, childId: quest.childId },
  });

  if (!parentChild) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const follow = await prisma.parentQuestFollow.upsert({
    where: { parentId_questId: { parentId: session.userId, questId } },
    update: { lastViewedAt: new Date() },
    create: {
      parentId: session.userId,
      childId: quest.childId,
      questId,
    },
  });

  return NextResponse.json({ success: true, follow });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  const session = await getParentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { questId } = await params;

  await prisma.parentQuestFollow.deleteMany({
    where: { parentId: session.userId, questId },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  const session = await getParentSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { questId } = await params;
  const body = await request.json().catch(() => ({}));

  const follow = await prisma.parentQuestFollow.update({
    where: { parentId_questId: { parentId: session.userId, questId } },
    data: {
      currentDay: body.currentDay,
      lastViewedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, follow });
}
```

**Step 2: Commit**

```bash
git add src/app/api/parent/follow/
git commit -m "feat: add parent quest follow API endpoints"
```

---

### Task 12: Create Parent Quest View Page

**Files:**
- Create: `src/app/[locale]/parent/quest/[id]/page.tsx`

**Step 1: Create parent quest view**

This page shows the parent a read-only view of their child's quest with:
- Current mission progress
- Tips for supporting today's activity
- Simple explanations of what the child is learning

```typescript
import { getTranslations } from "next-intl/server";
import { getParentSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Book, CheckCircle2, Lock, Play } from "lucide-react";

export default async function ParentQuestViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getParentSession();
  if (!session) redirect("/login");

  const t = await getTranslations("parent.quest");
  const { id: questId } = await params;

  const quest = await prisma.quest.findUnique({
    where: { id: questId },
    include: {
      child: { select: { id: true, name: true } },
      missions: { orderBy: { day: "asc" } },
    },
  });

  if (!quest) notFound();

  // Verify parent owns this child
  const parentChild = await prisma.parentChild.findFirst({
    where: { parentId: session.userId, childId: quest.childId },
  });

  if (!parentChild) notFound();

  // Track/update follow
  await prisma.parentQuestFollow.upsert({
    where: { parentId_questId: { parentId: session.userId, questId } },
    update: { lastViewedAt: new Date() },
    create: {
      parentId: session.userId,
      childId: quest.childId,
      questId,
    },
  });

  const currentMission = quest.missions.find(
    (m) => m.status === "in_progress" || m.status === "available",
  ) ?? quest.missions[quest.missions.length - 1];

  const completedCount = quest.missions.filter(
    (m) => m.status === "completed",
  ).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">
          {quest.child.name}'s Quest
        </p>
        <h1 className="text-2xl font-bold text-foreground">{quest.dream}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{completedCount}/7 {t("daysCompleted")}</span>
        </div>
      </header>

      {/* Progress timeline */}
      <div className="mb-8 flex gap-2">
        {quest.missions.map((mission) => {
          const isComplete = mission.status === "completed";
          const isCurrent = mission.id === currentMission?.id;
          const isLocked = mission.status === "locked";

          return (
            <div
              key={mission.id}
              className={`flex size-10 items-center justify-center rounded-full border-2 ${
                isComplete
                  ? "border-green-500 bg-green-50"
                  : isCurrent
                    ? "border-amber-500 bg-amber-50"
                    : "border-border bg-muted"
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="size-5 text-green-600" />
              ) : isLocked ? (
                <Lock className="size-4 text-muted-foreground" />
              ) : (
                <span className="text-sm font-semibold">{mission.day}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Current mission for parent */}
      {currentMission && (
        <section className="rounded-xl border border-border/60 bg-background p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {t("day")} {currentMission.day}: {currentMission.title}
          </h2>
          <p className="mb-4 text-muted-foreground">
            {currentMission.description}
          </p>

          <div className="rounded-lg bg-amber-50 p-4">
            <h3 className="mb-2 font-medium text-amber-900">
              {t("howToSupport")}
            </h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-amber-800">
              <li>{t("supportTip1")}</li>
              <li>{t("supportTip2")}</li>
              <li>{t("supportTip3")}</li>
            </ul>
          </div>

          {currentMission.materials && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">{t("materialsNeeded")}</h3>
              <div className="flex flex-wrap gap-2">
                {JSON.parse(currentMission.materials).map((m: string, i: number) => (
                  <span
                    key={i}
                    className="rounded-full bg-muted px-3 py-1 text-sm"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/[locale]/parent/quest/
git commit -m "feat: add parent quest view page with support tips"
```

---

### Task 13: Add Parent Guidance i18n

**Files:**
- Modify: `messages/en.json`, `messages/id.json`, `messages/zh.json`

**Step 1: Add translations**

Add `parent.quest` section:

**en.json:**
```json
"quest": {
  "daysCompleted": "days completed",
  "day": "Day",
  "howToSupport": "How to Support",
  "supportTip1": "Ask open-ended questions about their work",
  "supportTip2": "Celebrate effort, not just results",
  "supportTip3": "Let them lead — offer help only when asked",
  "materialsNeeded": "Materials needed",
  "followQuest": "Follow This Quest",
  "unfollowQuest": "Stop Following",
  "following": "Following"
}
```

**id.json:**
```json
"quest": {
  "daysCompleted": "hari selesai",
  "day": "Hari",
  "howToSupport": "Cara Mendukung",
  "supportTip1": "Ajukan pertanyaan terbuka tentang karya mereka",
  "supportTip2": "Rayakan usaha, bukan hanya hasil",
  "supportTip3": "Biarkan mereka memimpin — tawarkan bantuan hanya saat diminta",
  "materialsNeeded": "Bahan yang diperlukan",
  "followQuest": "Ikuti Quest Ini",
  "unfollowQuest": "Berhenti Mengikuti",
  "following": "Mengikuti"
}
```

**zh.json:**
```json
"quest": {
  "daysCompleted": "天已完成",
  "day": "第",
  "howToSupport": "如何支持",
  "supportTip1": "问一些关于他们作品的开放式问题",
  "supportTip2": "赞扬努力，而不仅仅是结果",
  "supportTip3": "让他们主导——只在被要求时提供帮助",
  "materialsNeeded": "所需材料",
  "followQuest": "关注此任务",
  "unfollowQuest": "取消关注",
  "following": "正在关注"
}
```

**Step 2: Commit**

```bash
git add messages/
git commit -m "feat: add parent quest guidance i18n (en/id/zh)"
```

---

## Session 4: Final Integration (Task 14)

### Task 14: Final Build Verification

Run: `bun run build && bunx prisma migrate dev && bunx prisma db seed`

Verify:
- PDF download works on reports page
- Tips library page loads with category filters
- Parent can view child's quest with guidance tips

---

## Summary

| Session | Tasks | What's Built |
|---------|-------|--------------|
| 1 | 1-5 | PDF template, generation API, download button |
| 2 | 6-9 | Tips API, tips library page, expanded tips content |
| 3 | 10-13 | ParentQuestFollow model, follow API, parent quest view |
| 4 | 14 | Final verification |

**New API routes:**
- `GET /api/parent/reports/[id]/pdf`
- `GET /api/parent/tips`
- `GET/POST/DELETE/PATCH /api/parent/follow/[questId]`

**New pages:**
- `/parent/tips` — Browsable tips library
- `/parent/quest/[id]` — Parent quest follow view

**New Prisma model:**
- `ParentQuestFollow`
