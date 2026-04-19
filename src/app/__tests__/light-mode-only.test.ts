import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SOURCE_ROOT = join(process.cwd(), "src");
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (entry === "__tests__") {
        return [];
      }

      return collectSourceFiles(fullPath);
    }

    const extension = fullPath.slice(fullPath.lastIndexOf("."));
    return ALLOWED_EXTENSIONS.has(extension) ? [fullPath] : [];
  });
}

describe("light mode only design system", () => {
  it("does not use Tailwind dark mode modifiers", () => {
    const filesWithDarkModeClasses = collectSourceFiles(SOURCE_ROOT).filter((file) =>
      readFileSync(file, "utf8").includes("dark:"),
    );

    expect(filesWithDarkModeClasses).toEqual([]);
  });

  it("does not use dark mode media queries", () => {
    const filesWithDarkMediaQueries = collectSourceFiles(SOURCE_ROOT).filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("prefers-color-scheme: dark");
    });

    expect(filesWithDarkMediaQueries).toEqual([]);
  });
});
