import { resolve } from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const repoRoot = import.meta.dirname;

// Offline-first Capacitor build: a fully static client SPA with everything
// bundled into the APK (no SSR, no server functions, no remote host — works in
// mainland China without hosting/ICP). Reuses the app's UI primitives,
// pure-logic libs (badges/age/zpd), i18n catalog, and styles from `src/`.
//
// `root` is the `offline/` dir so the built index.html lands flat at
// offline/dist/index.html (Capacitor `webDir` requires index.html at its root).
// Tailwind v4 auto-detects sources from the cwd (repo root), so reused
// components in src/ are still scanned.
//
// AI (Google Gemini, OpenAI-compatible) is called directly from the client when
// online; the key is injected at build time via VITE_GEMINI_API_KEY.
export default defineConfig({
  root: resolve(repoRoot, "offline"),
  // Load .env* from the repo root (not offline/), so VITE_GEMINI_API_KEY and
  // friends are read from the project's existing env files.
  envDir: repoRoot,
  // Bundle the app's static assets (fonts, mascots, story-prompt images) into
  // the APK so they load offline. Reuses the main app's public/ dir.
  publicDir: resolve(repoRoot, "public"),
  // Assets must load relative to https://localhost/ inside the native WebView.
  base: "./",
  resolve: {
    alias: { "@": resolve(repoRoot, "src") },
  },
  plugins: [tailwindcss(), viteReact()],
  build: {
    outDir: resolve(repoRoot, "offline/dist"),
    emptyOutDir: true,
  },
});
