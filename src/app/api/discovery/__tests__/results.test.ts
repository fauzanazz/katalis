import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  getChildSession: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    discovery: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { POST } from "../save/route";
import { GET as GETResult } from "../[id]/route";
import { GET as GETHistory } from "../history/route";
import { getChildSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockedGetSession = vi.mocked(getChildSession);
const mockedDiscovery = vi.mocked(prisma.discovery);

const validSession = { childId: "child-1", expiresAt: new Date().toISOString() };

const mockTalents = [
  {
    name: "Engineering & Mechanics",
    confidence: 0.92,
    reasoning: "The drawing shows remarkable attention to mechanical details.",
  },
  {
    name: "Spatial Reasoning",
    confidence: 0.78,
    reasoning: "The proportions are consistent and perspective maintained.",
  },
];

function createPostRequest(body: unknown) {
  return new Request("http://localhost:3100/api/discovery/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

function createGetRequest(url: string) {
  return new Request(url, {
    method: "GET",
  }) as unknown as Parameters<typeof GETResult>[0];
}

describe("POST /api/discovery/save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const res = await POST(
      createPostRequest({ type: "artifact", talents: mockTalents }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 201 with discovery record for valid artifact submission", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    const mockRecord = {
      id: "disc-1",
      childId: "child-1",
      type: "artifact",
      fileUrl: "http://localhost:3100/uploads/test.jpg",
      aiAnalysis: JSON.stringify({ talents: mockTalents }),
      detectedTalents: JSON.stringify(mockTalents),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedDiscovery.create.mockResolvedValue(mockRecord);

    const res = await POST(
      createPostRequest({
        type: "artifact",
        fileUrl: "http://localhost:3100/uploads/test.jpg",
        talents: mockTalents,
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("disc-1");
    expect(data.talents).toHaveLength(2);
  });

  it("returns 201 with discovery record for valid story submission", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    const mockRecord = {
      id: "disc-2",
      childId: "child-1",
      type: "story",
      fileUrl: null,
      aiAnalysis: JSON.stringify({ talents: mockTalents }),
      detectedTalents: JSON.stringify(mockTalents),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedDiscovery.create.mockResolvedValue(mockRecord);

    const res = await POST(
      createPostRequest({
        type: "story",
        talents: mockTalents,
      }),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("disc-2");
  });

  it("returns 400 for invalid type", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createPostRequest({ type: "video", talents: mockTalents }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty talents array", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(
      createPostRequest({ type: "artifact", talents: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing talents", async () => {
    mockedGetSession.mockResolvedValue(validSession);

    const res = await POST(createPostRequest({ type: "artifact" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/discovery/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const res = await GETResult(
      createGetRequest("http://localhost:3100/api/discovery/disc-1"),
      { params: Promise.resolve({ id: "disc-1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with discovery data for valid request", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedDiscovery.findUnique.mockResolvedValue({
      id: "disc-1",
      childId: "child-1",
      type: "artifact",
      fileUrl: "http://localhost:3100/uploads/test.jpg",
      aiAnalysis: JSON.stringify({ talents: mockTalents }),
      detectedTalents: JSON.stringify(mockTalents),
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-15"),
    });

    const res = await GETResult(
      createGetRequest("http://localhost:3100/api/discovery/disc-1"),
      { params: Promise.resolve({ id: "disc-1" }) },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("disc-1");
    expect(data.type).toBe("artifact");
    expect(data.talents).toHaveLength(2);
  });

  it("returns 404 for non-existent discovery", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedDiscovery.findUnique.mockResolvedValue(null);

    const res = await GETResult(
      createGetRequest("http://localhost:3100/api/discovery/non-existent"),
      { params: Promise.resolve({ id: "non-existent" }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when accessing another child's discovery", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedDiscovery.findUnique.mockResolvedValue({
      id: "disc-other",
      childId: "child-other",
      type: "artifact",
      fileUrl: null,
      aiAnalysis: JSON.stringify({ talents: mockTalents }),
      detectedTalents: JSON.stringify(mockTalents),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await GETResult(
      createGetRequest("http://localhost:3100/api/discovery/disc-other"),
      { params: Promise.resolve({ id: "disc-other" }) },
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /api/discovery/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockedGetSession.mockResolvedValue(null);

    const res = await GETHistory(
      createGetRequest("http://localhost:3100/api/discovery/history"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty array for child with no discoveries", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedDiscovery.findMany.mockResolvedValue([]);
    mockedDiscovery.count.mockResolvedValue(0);

    const res = await GETHistory(
      createGetRequest("http://localhost:3100/api/discovery/history"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.discoveries).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("returns discoveries ordered by date descending", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    const discoveries = [
      {
        id: "disc-2",
        childId: "child-1",
        type: "story",
        fileUrl: null,
        aiAnalysis: JSON.stringify({ talents: [mockTalents[0]] }),
        detectedTalents: JSON.stringify([mockTalents[0]]),
        createdAt: new Date("2024-02-01"),
        updatedAt: new Date("2024-02-01"),
      },
      {
        id: "disc-1",
        childId: "child-1",
        type: "artifact",
        fileUrl: "http://localhost:3100/uploads/test.jpg",
        aiAnalysis: JSON.stringify({ talents: mockTalents }),
        detectedTalents: JSON.stringify(mockTalents),
        createdAt: new Date("2024-01-15"),
        updatedAt: new Date("2024-01-15"),
      },
    ];
    mockedDiscovery.findMany.mockResolvedValue(discoveries);
    mockedDiscovery.count.mockResolvedValue(2);

    const res = await GETHistory(
      createGetRequest("http://localhost:3100/api/discovery/history"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.discoveries).toHaveLength(2);
    expect(data.discoveries[0].id).toBe("disc-2");
    expect(data.total).toBe(2);
  });

  it("supports pagination with page and limit params", async () => {
    mockedGetSession.mockResolvedValue(validSession);
    mockedDiscovery.findMany.mockResolvedValue([]);
    mockedDiscovery.count.mockResolvedValue(25);

    const res = await GETHistory(
      createGetRequest("http://localhost:3100/api/discovery/history?page=2&limit=10"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(25);
    expect(data.page).toBe(2);
    expect(data.limit).toBe(10);
  });
});
