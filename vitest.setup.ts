import { vi } from "vitest";

// Mock server-only to allow testing server components
vi.mock("server-only", () => ({}));
