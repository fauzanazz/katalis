/**
 * Compiles Paraglide messages with the exact same options used in vite.config.mts.
 *
 * Use this instead of `paraglide-js compile` CLI, which cannot express
 * `urlPatterns` and would silently break locale routing semantics.
 *
 * Usage: bun scripts/compile-paraglide.ts
 */

import { compile } from "@inlang/paraglide-js";

await compile({
  project: "./project.inlang",
  outdir: "./src/paraglide",
  // Matches what paraglide's Vite unplugin sets in its vite.config hook
  // (unplugin.js lines 221-230) before calling compile(). Without this,
  // compile() falls back to the default `typeof window === 'undefined'`,
  // which breaks SSR tree-shaking under Vite's import.meta.env.SSR.
  isServer: "import.meta.env?.SSR ?? typeof window === 'undefined'",
  strategy: ["url", "cookie", "baseLocale"],
  urlPatterns: [
    {
      pattern: ":protocol://:domain(.*)::port?/:path(.*)?",
      localized: [
        ["en", ":protocol://:domain(.*)::port?/en/:path(.*)?"],
        ["id", ":protocol://:domain(.*)::port?/id/:path(.*)?"],
        ["zh", ":protocol://:domain(.*)::port?/zh/:path(.*)?"],
      ],
    },
  ],
});

console.log("Paraglide compiled successfully.");
