import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Skill scripts ship their own tooling configs.
    ".agents/**",
  ]),
  {
    rules: {
      // React 19 hooks rules. `set-state-in-effect` flags hydration-on-mount
      // patterns (sessionStorage / localStorage / window.matchMedia) that are
      // intentional and SSR-safe. We surface it as a warning so future
      // refactors toward `useSyncExternalStore` are still encouraged without
      // blocking CI on legitimate hydration code.
      "react-hooks/set-state-in-effect": "warn",
      // Allow `_`-prefixed names for intentionally-unused params/vars
      // (e.g. mock signatures that must match a real interface).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
