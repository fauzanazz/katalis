import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getUserSession: vi.fn(),
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

const mockDb = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { POST } from "../route";
import { getUserSession } from "@/lib/auth";
import { getAgeGroup } from "@/lib/age";

const mockedGetUserSession = vi.mocked(getUserSession);
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

function makeTx(overrides?: Partial<{
  accessCodeFindFirst: ReturnType<typeof vi.fn>;
  accessCodeInsertReturning: ReturnType<typeof vi.fn>;
  childInsertReturning: ReturnType<typeof vi.fn>;
  parentChildInsertValues: ReturnType<typeof vi.fn>;
}>) {
  const accessCodeFindFirst = overrides?.accessCodeFindFirst ?? vi.fn().mockResolvedValue(null);
  const accessCodeInsertReturning = overrides?.accessCodeInsertReturning ?? vi.fn().mockResolvedValue([mockAccessCode]);
  const childInsertReturning = overrides?.childInsertReturning ?? vi.fn().mockResolvedValue([mockChild]);
  const parentChildInsertValues = overrides?.parentChildInsertValues ?? vi.fn().mockResolvedValue(undefined);

  return {
    query: {
      accessCodes: { findFirst: accessCodeFindFirst },
    },
    insert: vi.fn((table: unknown) => {
      // Distinguish tables by reference — use a map approach
      return {
        values: vi.fn((vals: unknown) => {
          if (vals && typeof vals === "object" && "code" in (vals as Record<string, unknown>)) {
            return { returning: accessCodeInsertReturning };
          }
          if (vals && typeof vals === "object" && "name" in (vals as Record<string, unknown>)) {
            return { returning: childInsertReturning };
          }
          // parentChildren insert — no returning
          (parentChildInsertValues as (v: unknown) => unknown)(vals);
          return Promise.resolve(undefined);
        }),
      };
    }),
    _parentChildInsertValues: parentChildInsertValues,
  };
}

function setupHappyPath() {
  mockedGetUserSession.mockResolvedValue(validSession as never);
  mockedGetAgeGroup.mockReturnValue({ years: 7, band: "middle" } as never);
  mockDb.transaction.mockImplementation(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
    return fn(makeTx());
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/parent/create-child", () => {
  describe("consent record", () => {
    it("creates ParentChild with consentGivenAt close to now", async () => {
      mockedGetUserSession.mockResolvedValue(validSession as never);
      mockedGetAgeGroup.mockReturnValue({ years: 7, band: "middle" } as never);

      const parentChildInsertValues = vi.fn().mockResolvedValue(undefined);
      const capturedTx = makeTx({ parentChildInsertValues });

      mockDb.transaction.mockImplementation(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
        return fn(capturedTx);
      });

      const before = Date.now();
      const res = await POST(makePostRequest({ name: "Alice", dateOfBirth: validDobIso }));
      expect(res.status).toBe(200);

      expect(parentChildInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          consentGivenAt: expect.any(Date),
        }),
      );

      const callArgs = parentChildInsertValues.mock.calls[0][0] as Record<string, unknown>;
      const consentGivenAt = callArgs.consentGivenAt as Date;
      expect(consentGivenAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(consentGivenAt.getTime()).toBeLessThanOrEqual(Date.now() + 5000);
    });

    it("creates ParentChild with consentTextVersion = 'v1'", async () => {
      mockedGetUserSession.mockResolvedValue(validSession as never);
      mockedGetAgeGroup.mockReturnValue({ years: 7, band: "middle" } as never);

      const parentChildInsertValues = vi.fn().mockResolvedValue(undefined);
      const capturedTx = makeTx({ parentChildInsertValues });

      mockDb.transaction.mockImplementation(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
        return fn(capturedTx);
      });

      await POST(makePostRequest({ name: "Alice", dateOfBirth: validDobIso }));

      expect(parentChildInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          consentTextVersion: "v1",
        }),
      );
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
