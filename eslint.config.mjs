import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Flat ESLint config for the TanStack Start app (post-Next cutover).
 *
 * Replaces the former `eslint-config-next` preset. We keep the React Compiler
 * rule set from `eslint-plugin-react-hooks` (the codebase is written to satisfy
 * it — see AGENTS.md "Lint notes") and the TS unused-vars rule, but skip the
 * full `typescript-eslint` recommended set: `tsc --noEmit` (bun run typecheck)
 * already owns type correctness, and adding it would only surface new lint
 * failures unrelated to this migration.
 */
const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    // Build artifacts of the TanStack Start / Nitro pipeline.
    ".output/**",
    ".nitro/**",
    ".vercel/**",
    // Generated Paraglide message modules.
    "src/paraglide/**",
    // Skill scripts ship their own tooling configs.
    ".agents/**",
    // Generated Capacitor native projects + the bundled offline build output.
    "android/**",
    "ios/**",
    "offline/dist/**",
    // Vendored / minified third-party bundles (e.g. lottie.min.js).
    "**/*.min.js",
  ]),
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // SSR-safe hydration (`useEffect` → read sessionStorage/localStorage →
      // setState) is intentional here; surface as warning, not error.
      "react-hooks/set-state-in-effect": "warn",
      // Allow `_`-prefixed names for intentionally-unused params/vars
      // (e.g. mock signatures that must match a real interface).
      "no-unused-vars": "off",
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
