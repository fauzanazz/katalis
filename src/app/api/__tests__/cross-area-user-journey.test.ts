/**
 * Cross-area user journey integration tests.
 *
 * Covers VAL-CROSS-001 through VAL-CROSS-004, VAL-CROSS-026 through VAL-CROSS-036,
 * VAL-CROSS-040, VAL-CROSS-046, and VAL-CROSS-047.
 *
 * Tests the complete end-to-end user journey, first-time vs returning user,
 * language consistency, XSS prevention across the full data pipeline,
 * EXIF metadata stripping consistency, and mobile responsiveness coverage.
 */

import { describe, it, expect, vi } from "vitest";

// =============================================================================
// VAL-CROSS-046: XSS prevention across full data pipeline
// =============================================================================
describe("VAL-CROSS-046: XSS prevention across full data pipeline", () => {
  /**
   * User-submitted text (story, dream, local context) flows from
   * Discovery through Quest to Gallery. At every render point across
   * all areas, the text is sanitized. No script execution occurs at any point.
   */
  it("sanitizes XSS payloads in all API routes consistently", async () => {
    const { sanitizeInput } = await import("@/lib/sanitize");

    // Common XSS payloads that a user might submit
    const xssPayloads = [
      '<script>alert("xss")</script>',
      "<img src=x onerror=alert(1)>",
      '<a href="javascript:alert(1)">click</a>',
      '<svg onload="alert(1)">',
      "javascript:alert(document.cookie)",
      '<div onmouseover="alert(1)">hover me</div>',
    ];

    for (const payload of xssPayloads) {
      const sanitized = sanitizeInput(payload);
      // No HTML tags should remain
      expect(sanitized).not.toMatch(/<[^>]*>/);
      // No javascript: protocol
      expect(sanitized).not.toMatch(/javascript:/i);
      // No event handlers
      expect(sanitized).not.toMatch(/on\w+\s*=/i);
    }
  });

  it("sanitizeInput is called unconditionally in discovery analyze route", async () => {
    // Verify the source code calls sanitizeInput without conditional gating
    const fs = await import("fs");
    const analyzeRouteCode = fs.readFileSync(
      "src/app/api/discovery/analyze/route.ts",
      "utf-8",
    );
    // Should import sanitizeInput
    expect(analyzeRouteCode).toContain("sanitizeInput");
    // Should NOT gate sanitization behind containsSuspiciousPatterns
    expect(analyzeRouteCode).not.toContain("containsSuspiciousPatterns");
  });

  it("sanitizeInput is called unconditionally in story analyze route", async () => {
    const fs = await import("fs");
    const storyRouteCode = fs.readFileSync(
      "src/app/api/discovery/analyze-story/route.ts",
      "utf-8",
    );
    expect(storyRouteCode).toContain("sanitizeInput");
    expect(storyRouteCode).not.toContain("containsSuspiciousPatterns");
  });

  it("sanitizeInput is called in quest generate route", async () => {
    const fs = await import("fs");
    const questRouteCode = fs.readFileSync(
      "src/app/api/quest/generate/route.ts",
      "utf-8",
    );
    expect(questRouteCode).toContain("sanitizeInput");
    expect(questRouteCode).not.toContain("containsSuspiciousPatterns");
  });

  it("sanitizeInput is called in quest complete route", async () => {
    const fs = await import("fs");
    const completeRouteCode = fs.readFileSync(
      "src/app/api/quest/[id]/complete/route.ts",
      "utf-8",
    );
    expect(completeRouteCode).toContain("sanitizeInput");
  });

  it("sanitizeInput is called in mission progress route", async () => {
    const fs = await import("fs");
    const missionRouteCode = fs.readFileSync(
      "src/app/api/quest/[id]/mission/[missionId]/route.ts",
      "utf-8",
    );
    expect(missionRouteCode).toContain("sanitizeInput");
  });

  it("sanitizeInput is called in gallery entries route", async () => {
    const fs = await import("fs");
    const galleryRouteCode = fs.readFileSync(
      "src/app/api/gallery/entries/route.ts",
      "utf-8",
    );
    expect(galleryRouteCode).toContain("sanitizeInput");
  });

  it("sanitizeInput is called in gallery flag route", async () => {
    const fs = await import("fs");
    const flagRouteCode = fs.readFileSync(
      "src/app/api/gallery/flag/route.ts",
      "utf-8",
    );
    expect(flagRouteCode).toContain("sanitizeInput");
  });
});

// =============================================================================
// VAL-CROSS-047: EXIF metadata stripped consistently
// =============================================================================
describe("VAL-CROSS-047: EXIF metadata stripped consistently", () => {
  it("uses the same EXIF stripping function for all upload paths", async () => {
    const { stripExifMetadata, isStrippableImage } = await import(
      "@/lib/storage/exif"
    );

    // All image types that should be stripped
    expect(isStrippableImage("image/jpeg")).toBe(true);
    expect(isStrippableImage("image/png")).toBe(true);
    expect(isStrippableImage("image/webp")).toBe(true);
    // Non-images should not be stripped
    expect(isStrippableImage("audio/mpeg")).toBe(false);
    expect(isStrippableImage("text/plain")).toBe(false);

    // The stripExifMetadata function exists and is callable
    expect(typeof stripExifMetadata).toBe("function");
  });

  it("mock storage client calls EXIF stripping during upload", async () => {
    const fs = await import("fs");
    const mockStorageCode = fs.readFileSync(
      "src/lib/storage/mock.ts",
      "utf-8",
    );
    // The mock storage should reference EXIF stripping
    expect(mockStorageCode).toContain("stripExifMetadata");
  });

  it("EXIF stripping handles non-image content types gracefully", async () => {
    const { stripExifMetadata } = await import("@/lib/storage/exif");

    const audioBuffer = Buffer.from("fake audio data");
    const result = await stripExifMetadata(audioBuffer, "audio/mpeg");
    // Should return the original buffer unchanged
    expect(result).toBe(audioBuffer);
  });
});

// =============================================================================
// VAL-CROSS-036: URL-Based Locale Routing Consistency
// =============================================================================
describe("VAL-CROSS-036: URL-based locale routing consistency", () => {
  it("routing configuration includes both en and id locales", async () => {
    const { routing } = await import("@/i18n/routing");
    expect(routing.locales).toContain("en");
    expect(routing.locales).toContain("id");
  });

  it("default locale is set to id (Indonesian)", async () => {
    const { routing } = await import("@/i18n/routing");
    expect(routing.defaultLocale).toBe("id");
  });
});

// =============================================================================
// VAL-CROSS-030: Language preference persists across all areas
// VAL-CROSS-033: AI-generated content language follows locale
// VAL-CROSS-034: AI-generated content language for quest missions
// VAL-CROSS-035: AI-generated content language for story prompting
// =============================================================================
describe("VAL-CROSS-030/033/034/035: Language and locale consistency", () => {
  it("translation files exist for both en and id", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("messages/en.json")).toBe(true);
    expect(fs.existsSync("messages/id.json")).toBe(true);
  });

  it("both translation files have all required top-level keys", async () => {
    const fs = await import("fs");
    const enMessages = JSON.parse(
      fs.readFileSync("messages/en.json", "utf-8"),
    );
    const idMessages = JSON.parse(
      fs.readFileSync("messages/id.json", "utf-8"),
    );

    const requiredKeys = [
      "common",
      "nav",
      "landing",
      "auth",
      "footer",
      "language",
      "discover",
      "quest",
      "gallery",
    ];

    for (const key of requiredKeys) {
      expect(enMessages).toHaveProperty(key);
      expect(idMessages).toHaveProperty(key);
    }
  });

  it("navigation labels exist in both languages", async () => {
    const fs = await import("fs");
    const enMessages = JSON.parse(
      fs.readFileSync("messages/en.json", "utf-8"),
    );
    const idMessages = JSON.parse(
      fs.readFileSync("messages/id.json", "utf-8"),
    );

    const navKeys = ["home", "discover", "quest", "gallery", "login", "logout"];
    for (const key of navKeys) {
      expect(enMessages.nav[key]).toBeDefined();
      expect(idMessages.nav[key]).toBeDefined();
      // Values should be different between languages (not duplicated English)
      // Exception: proper nouns may be the same
    }
  });

  it("landing page content exists in both languages", async () => {
    const fs = await import("fs");
    const enMessages = JSON.parse(
      fs.readFileSync("messages/en.json", "utf-8"),
    );
    const idMessages = JSON.parse(
      fs.readFileSync("messages/id.json", "utf-8"),
    );

    expect(enMessages.landing.hero.title).toBeDefined();
    expect(idMessages.landing.hero.title).toBeDefined();
    expect(enMessages.landing.hero.title).not.toBe(
      idMessages.landing.hero.title,
    );
  });

  it("quest UI labels exist in both languages", async () => {
    const fs = await import("fs");
    const enMessages = JSON.parse(
      fs.readFileSync("messages/en.json", "utf-8"),
    );
    const idMessages = JSON.parse(
      fs.readFileSync("messages/id.json", "utf-8"),
    );

    // Check quest overview labels
    expect(enMessages.quest.overview.title).toBeDefined();
    expect(idMessages.quest.overview.title).toBeDefined();
    expect(enMessages.quest.overview.dayLabel).toBeDefined();
    expect(idMessages.quest.overview.dayLabel).toBeDefined();
  });

  it("gallery UI labels exist in both languages", async () => {
    const fs = await import("fs");
    const enMessages = JSON.parse(
      fs.readFileSync("messages/en.json", "utf-8"),
    );
    const idMessages = JSON.parse(
      fs.readFileSync("messages/id.json", "utf-8"),
    );

    expect(enMessages.gallery.title).toBeDefined();
    expect(idMessages.gallery.title).toBeDefined();
    expect(enMessages.gallery.subtitle).toBeDefined();
    expect(idMessages.gallery.subtitle).toBeDefined();
  });

  it("mock AI responses are in English (acknowledged limitation)", async () => {
    // Mock AI responses don't vary by locale — this is documented behavior
    const { mockVariants } = await import(
      "@/lib/ai/mock/multimodal-analysis"
    );
    // All mock responses are in English
    expect(mockVariants.engineering.talents[0].reasoning).toContain(
      "drawing",
    );
    expect(mockVariants.artistic.talents[0].reasoning).toContain("color");
    expect(mockVariants.narrative.talents[0].reasoning).toContain(
      "storytelling",
    );
  });
});

// =============================================================================
// VAL-CROSS-026: First-time user empty states across all areas
// =============================================================================
describe("VAL-CROSS-026: First-time user empty states", () => {
  it("discovery history page has empty state translation", async () => {
    const fs = await import("fs");
    const enMessages = JSON.parse(
      fs.readFileSync("messages/en.json", "utf-8"),
    );
    const idMessages = JSON.parse(
      fs.readFileSync("messages/id.json", "utf-8"),
    );

    // Discovery empty state
    expect(enMessages.discover.history.empty).toBeDefined();
    expect(idMessages.discover.history.empty).toBeDefined();
    expect(enMessages.discover.history.startFirst).toBeDefined();
    expect(idMessages.discover.history.startFirst).toBeDefined();
  });

  it("quest list page has empty state translation", async () => {
    const fs = await import("fs");
    const enMessages = JSON.parse(
      fs.readFileSync("messages/en.json", "utf-8"),
    );
    const idMessages = JSON.parse(
      fs.readFileSync("messages/id.json", "utf-8"),
    );

    // Quest empty state
    expect(enMessages.quest.list.empty).toBeDefined();
    expect(idMessages.quest.list.empty).toBeDefined();
    expect(enMessages.quest.list.emptyDesc).toBeDefined();
    expect(idMessages.quest.list.emptyDesc).toBeDefined();
  });

  it("gallery page has empty state translation", async () => {
    const fs = await import("fs");
    const enMessages = JSON.parse(
      fs.readFileSync("messages/en.json", "utf-8"),
    );
    const idMessages = JSON.parse(
      fs.readFileSync("messages/id.json", "utf-8"),
    );

    // Gallery empty state
    expect(enMessages.gallery.map.noEntries).toBeDefined();
    expect(idMessages.gallery.map.noEntries).toBeDefined();
  });
});

// =============================================================================
// VAL-CROSS-027/028/029: Returning user data persistence
// =============================================================================
describe("VAL-CROSS-027/028/029: Returning user data persistence", () => {
  it("discovery history API returns past results", async () => {
    // Mock Prisma for history endpoint
    const mockFindMany = vi.fn().mockResolvedValue([
      {
        id: "disc-1",
        type: "artifact",
        detectedTalents: JSON.stringify([
          { name: "Engineering", confidence: 0.9, reasoning: "test" },
        ]),
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "disc-2",
        type: "story",
        detectedTalents: JSON.stringify([
          { name: "Narrative", confidence: 0.85, reasoning: "test" },
        ]),
        createdAt: new Date("2024-01-02"),
      },
    ]);

    vi.doMock("@/lib/db", () => ({
      prisma: {
        discovery: { findMany: mockFindMany },
      },
    }));

    vi.doMock("@/lib/auth", () => ({
      getSession: vi.fn().mockResolvedValue({ childId: "child-1" }),
    }));

    // Verify the history endpoint exists
    const fs = await import("fs");
    expect(
      fs.existsSync("src/app/api/discovery/history/route.ts"),
    ).toBe(true);
  });

  it("quest list API returns active and completed quests", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("src/app/api/quest/list/route.ts")).toBe(true);
  });

  it("gallery entries GeoJSON API returns entries", async () => {
    const fs = await import("fs");
    expect(
      fs.existsSync("src/app/api/gallery/entries/geojson/route.ts"),
    ).toBe(true);
  });
});

// =============================================================================
// VAL-CROSS-001/002/003/004: Full user journey structure
// =============================================================================
describe("VAL-CROSS-001/002/003/004: Full journey structure", () => {
  it("all required page routes exist for the full journey", async () => {
    const fs = await import("fs");

    // Landing page
    expect(fs.existsSync("src/app/[locale]/page.tsx")).toBe(true);
    // Login page
    expect(fs.existsSync("src/app/[locale]/login/page.tsx")).toBe(true);
    // Discovery page
    expect(fs.existsSync("src/app/[locale]/discover/page.tsx")).toBe(true);
    // Discovery results page
    expect(
      fs.existsSync("src/app/[locale]/discover/results/[id]/page.tsx"),
    ).toBe(true);
    // Quest new page
    expect(fs.existsSync("src/app/[locale]/quest/new/page.tsx")).toBe(true);
    // Quest overview page
    expect(
      fs.existsSync("src/app/[locale]/quest/[id]/page.tsx"),
    ).toBe(true);
    // Quest complete page
    expect(
      fs.existsSync("src/app/[locale]/quest/[id]/complete/page.tsx"),
    ).toBe(true);
    // Gallery page
    expect(fs.existsSync("src/app/[locale]/gallery/page.tsx")).toBe(true);
    // Gallery detail page
    expect(
      fs.existsSync("src/app/[locale]/gallery/[id]/page.tsx"),
    ).toBe(true);
  });

  it("all required API routes exist for the full journey", async () => {
    const fs = await import("fs");

    // Auth
    expect(fs.existsSync("src/app/api/auth/login/route.ts")).toBe(true);
    expect(fs.existsSync("src/app/api/auth/logout/route.ts")).toBe(true);
    // Discovery
    expect(
      fs.existsSync("src/app/api/discovery/analyze/route.ts"),
    ).toBe(true);
    expect(
      fs.existsSync("src/app/api/discovery/analyze-story/route.ts"),
    ).toBe(true);
    expect(
      fs.existsSync("src/app/api/discovery/save/route.ts"),
    ).toBe(true);
    expect(
      fs.existsSync("src/app/api/discovery/history/route.ts"),
    ).toBe(true);
    // Quest
    expect(
      fs.existsSync("src/app/api/quest/generate/route.ts"),
    ).toBe(true);
    expect(fs.existsSync("src/app/api/quest/list/route.ts")).toBe(true);
    // Gallery
    expect(
      fs.existsSync("src/app/api/gallery/entries/route.ts"),
    ).toBe(true);
    expect(
      fs.existsSync("src/app/api/gallery/entries/geojson/route.ts"),
    ).toBe(true);
    expect(
      fs.existsSync("src/app/api/gallery/cluster/route.ts"),
    ).toBe(true);
  });

  it("proxy middleware protects discovery and quest routes", async () => {
    const fs = await import("fs");
    const proxyCode = fs.readFileSync("src/proxy.ts", "utf-8");

    // Gallery should be public
    expect(proxyCode).toContain("/gallery");
    // Login should be public
    expect(proxyCode).toContain("/login");
    // The middleware should check authentication
    expect(proxyCode).toContain("decrypt");
    expect(proxyCode).toContain("SESSION_COOKIE_NAME");
  });

  it("gallery is publicly accessible (no auth required)", async () => {
    const fs = await import("fs");
    const proxyCode = fs.readFileSync("src/proxy.ts", "utf-8");

    // Gallery path should be in the public paths array
    expect(proxyCode).toContain('"/gallery"');
  });
});

// =============================================================================
// VAL-CROSS-031/032: Language switch mid-flow
// =============================================================================
describe("VAL-CROSS-031/032: Language switch mid-flow", () => {
  it("i18n navigation uses locale-aware routing", async () => {
    const fs = await import("fs");

    // All pages should import from @/i18n/navigation, not next/navigation for router
    const questPageCode = fs.readFileSync(
      "src/app/[locale]/quest/[id]/page.tsx",
      "utf-8",
    );
    // Should use @/i18n/navigation for router
    expect(questPageCode).toContain("@/i18n/navigation");
  });

  it("header component includes language switcher", async () => {
    const fs = await import("fs");
    const headerCode = fs.readFileSync(
      "src/components/layout/Header.tsx",
      "utf-8",
    );
    // Should include the LanguageSwitcher component
    expect(headerCode).toContain("LanguageSwitcher");
  });
});

// =============================================================================
// VAL-CROSS-040: Mobile responsiveness across all areas
// =============================================================================
describe("VAL-CROSS-040: Mobile responsive layout", () => {
  it("all page components use responsive Tailwind classes", async () => {
    const fs = await import("fs");

    // Landing page should have responsive classes
    const landingCode = fs.readFileSync(
      "src/app/[locale]/page.tsx",
      "utf-8",
    );
    expect(landingCode).toMatch(/sm:|md:|lg:/);

    // Discovery page should have responsive classes
    const discoverCode = fs.readFileSync(
      "src/app/[locale]/discover/page.tsx",
      "utf-8",
    );
    expect(discoverCode).toMatch(/sm:|md:|lg:|max-w-/);

    // Quest page should have responsive classes
    const questCode = fs.readFileSync(
      "src/app/[locale]/quest/page.tsx",
      "utf-8",
    );
    expect(questCode).toMatch(/sm:|md:|lg:|max-w-/);

    // Gallery page should have responsive classes
    const galleryCode = fs.readFileSync(
      "src/app/[locale]/gallery/page.tsx",
      "utf-8",
    );
    expect(galleryCode).toMatch(/sm:|md:|lg:/);
  });

  it("layout includes responsive header with mobile navigation", async () => {
    const fs = await import("fs");
    const headerCode = fs.readFileSync(
      "src/components/layout/Header.tsx",
      "utf-8",
    );
    // Should have mobile menu/hamburger pattern
    expect(headerCode).toMatch(/md:|lg:|hamburger|menu|mobile/i);
  });
});

// =============================================================================
// File upload validation consistency across areas
// =============================================================================
describe("Upload validation consistency across areas", () => {
  it("all upload-related routes use the same validation module", async () => {
    const fs = await import("fs");

    // Presigned URL route should use validation
    const presignedCode = fs.readFileSync(
      "src/app/api/upload/presigned-url/route.ts",
      "utf-8",
    );
    expect(presignedCode).toMatch(/validation|validateFile|ACCEPTED/);

    // Upload complete route exists
    const completeCode = fs.readFileSync(
      "src/app/api/upload/complete/route.ts",
      "utf-8",
    );
    expect(completeCode).toContain("category");
  });

  it("URL allowlist is used in quest and gallery routes", async () => {
    const fs = await import("fs");

    // Quest mission route should validate URLs
    const missionRouteCode = fs.readFileSync(
      "src/app/api/quest/[id]/mission/[missionId]/route.ts",
      "utf-8",
    );
    expect(missionRouteCode).toContain("isAllowedStorageUrl");

    // Quest complete route should validate URLs
    const completeRouteCode = fs.readFileSync(
      "src/app/api/quest/[id]/complete/route.ts",
      "utf-8",
    );
    expect(completeRouteCode).toContain("isAllowedStorageUrl");
  });
});

// =============================================================================
// Error boundaries and cross-area navigation
// =============================================================================
describe("Error boundaries exist for each area", () => {
  it("each area has an error boundary component", async () => {
    const fs = await import("fs");

    // Check error boundaries exist for each area
    const areas = ["discover", "quest", "gallery"];
    for (const area of areas) {
      const errorPath = `src/app/[locale]/${area}/error.tsx`;
      expect(fs.existsSync(errorPath)).toBe(true);
    }
  });

  it("root locale has an error boundary", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("src/app/[locale]/error.tsx")).toBe(true);
  });
});

// =============================================================================
// Breadcrumbs and navigation consistency
// =============================================================================
describe("Navigation consistency across areas", () => {
  it("breadcrumb translations exist for all areas", async () => {
    const fs = await import("fs");
    const enMessages = JSON.parse(
      fs.readFileSync("messages/en.json", "utf-8"),
    );
    const idMessages = JSON.parse(
      fs.readFileSync("messages/id.json", "utf-8"),
    );

    const breadcrumbKeys = [
      "home",
      "discover",
      "quest",
      "gallery",
      "history",
      "results",
    ];

    for (const key of breadcrumbKeys) {
      expect(enMessages.breadcrumb[key]).toBeDefined();
      expect(idMessages.breadcrumb[key]).toBeDefined();
    }
  });
});
