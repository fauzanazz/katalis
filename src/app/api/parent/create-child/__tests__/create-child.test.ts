import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getUserSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/age", () => ({
  getAgeGroup: vi.fn(),
}));

vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en", "id", "zh"] as const,
    defaultLocale: "en",
  },
}));

import { POST } from "../route";
import { getUserSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAgeGroup } from "@/lib/age";

const mockedGetUserSession = vi.mocked(getUserSession);
const mockedTransaction = vi.mocked(prisma.$transaction);
const mockedGetAgeGroup = vi.mocked(getAgeGroup);

const validSession = { userId: "parent-1", role: "user" };
const validDob = new Date();
validDob.setFullYear(validDob.getFullYear() - 7);
const validDobIso = validDob.toISOString();

function makePostRequest(body: unknown) {
  return new Request("http://localhost:3100/api/parent/create-child", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockChild = {
  id: "child-1",
  name: "Alice",
  locale: "en",
  dateOfBirth: validDob,
  createdAt: new Date(),
};

const mockAccessCode = { id: "ac-1", code: "KATAL-ABCDEF" };

function setupHappyPath() {
  mockedGetUserSession.mockResolvedValue(validSession as never);
  mockedGetAgeGroup.mockReturnValue({ years: 7, band: "middle" } as never);
  mockedTransaction.mockImplementation(async (fn) => {
    const tx = {
      accessCode: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(mockAccessCode),
      },
      child: {
        create: vi.fn().mockResolvedValue(mockChild),
      },
      parentChild: {
        create: vi.fn().mockResolvedValue({ userId: "parent-1", childId: "child-1" }),
      },
    };
    return fn(tx as never);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/parent/create-child", () => {
  describe("consent record", () => {
    it("creates ParentChild with consentGivenAt close to now", async () => {
      setupHappyPath();
      const before = Date.now();

      const res = await POST(makePostRequest({ name: "Alice", dateOfBirth: validDobIso }));

      expect(res.status).toBe(200);

      const txFn = mockedTransaction.mock.calls[0][0];
      const capturedTx = {
        accessCode: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(mockAccessCode),
        },
        child: {
          create: vi.fn().mockResolvedValue(mockChild),
        },
        parentChild: {
          create: vi.fn(),
        },
      };
      capturedTx.parentChild.create.mockResolvedValue({});
      await txFn(capturedTx as never);

      const parentChildCall = capturedTx.parentChild.create.mock.calls[0][0];
      const consentGivenAt: Date = parentChildCall.data.consentGivenAt;

      expect(consentGivenAt).toBeInstanceOf(Date);
      expect(consentGivenAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(consentGivenAt.getTime()).toBeLessThanOrEqual(Date.now() + 5000);
    });

    it("creates ParentChild with consentTextVersion = 'v1'", async () => {
      setupHappyPath();

      await POST(makePostRequest({ name: "Alice", dateOfBirth: validDobIso }));

      const txFn = mockedTransaction.mock.calls[0][0];
      const capturedTx = {
        accessCode: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(mockAccessCode),
        },
        child: {
          create: vi.fn().mockResolvedValue(mockChild),
        },
        parentChild: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      await txFn(capturedTx as never);

      const parentChildCall = capturedTx.parentChild.create.mock.calls[0][0];
      expect(parentChildCall.data.consentTextVersion).toBe("v1");
    });
  });

  describe("validation", () => {
    it("rejects missing name", async () => {
      mockedGetUserSession.mockResolvedValue(validSession as never);

      const res = await POST(makePostRequest({ dateOfBirth: validDobIso }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("invalid");
    });

    it("rejects invalid dateOfBirth (not ISO datetime)", async () => {
      mockedGetUserSession.mockResolvedValue(validSession as never);

      const res = await POST(makePostRequest({ name: "Alice", dateOfBirth: "not-a-date" }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("invalid");
    });

    it("rejects age below 3", async () => {
      mockedGetUserSession.mockResolvedValue(validSession as never);
      mockedGetAgeGroup.mockReturnValue({ years: 2, band: null } as never);

      const infantDob = new Date();
      infantDob.setFullYear(infantDob.getFullYear() - 2);

      const res = await POST(makePostRequest({ name: "Baby", dateOfBirth: infantDob.toISOString() }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("invalid");
    });

    it("rejects age above 12", async () => {
      mockedGetUserSession.mockResolvedValue(validSession as never);
      mockedGetAgeGroup.mockReturnValue({ years: 13, band: null } as never);

      const teenDob = new Date();
      teenDob.setFullYear(teenDob.getFullYear() - 13);

      const res = await POST(makePostRequest({ name: "Teen", dateOfBirth: teenDob.toISOString() }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("invalid");
    });

    it("rejects unauthenticated requests", async () => {
      mockedGetUserSession.mockResolvedValue(null as never);

      const res = await POST(makePostRequest({ name: "Alice", dateOfBirth: validDobIso }));

      expect(res.status).toBe(401);
    });
  });
});
