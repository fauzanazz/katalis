import { vi } from "vitest";

// Re-export from parent setup which has all the translations
import "../../__tests__/setup";

// Override useParams to return the quest id
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-quest-id" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/quest/test-quest-id",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));
