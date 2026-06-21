import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig, loadEnv } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { devMockStoragePlugin } from "./vite/dev-mock-storage";

// Client modules carried over from Next (e.g. components/map/GalleryMap,
// lib/storage/media-url) read NEXT_PUBLIC_* config via `process.env`. Vite does
// not polyfill `process` in the browser, so those reads would throw at runtime.
// Statically inject the known client-public vars (NEXT_PUBLIC_* are public by
// Next convention — no secrets) so the shared code works unchanged. Unset vars
// default to "" to avoid `process is not defined` ReferenceErrors.
const CLIENT_ENV_KEYS = [
  "NEXT_PUBLIC_MAPTILER_KEY",
  "NEXT_PUBLIC_CN_TILE_URL",
  "NEXT_PUBLIC_CN_TILE_ATTRIBUTION",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_R2_PUBLIC_URL",
  "NEXT_PUBLIC_CN_MEDIA_URL",
];

// TanStack Start dev server runs on 3101 so the existing Next app (3100) keeps
// working during the incremental migration. Remove the Next config once cutover
// completes (Phase 5).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "NEXT_PUBLIC_");
  const define: Record<string, string> = {};
  for (const key of CLIENT_ENV_KEYS) {
    define[`process.env.${key}`] = JSON.stringify(env[key] ?? process.env[key] ?? "");
  }
  return {
  define,
  server: {
    port: 3101,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    // Locale resolution order: URL prefix (/en, /id, /zh) → cookie → base ("id").
    // urlPatterns prefixes ALL locales (incl. base "id") to match the existing
    // Next route structure (paraglide's default leaves the base locale unprefixed).
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
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
    }),
    tailwindcss(),
    // Dev-only: receives mock-storage upload PUTs when USE_MOCK_STORAGE/
    // USE_MOCK_AI is set (prod uploads go straight to R2). `apply: "serve"`
    // keeps it out of the built `.output`.
    devMockStoragePlugin(),
    tanstackStart({ srcDirectory: "src" }),
    viteReact(),
    // Nitro unconditionally registers `<rootDir>/assets` as a server-asset dir
    // with no `ignore`, so its build tries to `raw:`-import every file under it
    // — including the mascot design previews (assets/mascot/preview*.html).
    // Standalone HTML gets routed through Vite's html plugin during that import,
    // which emits an inline-css proxy module that the `nitro:raw` plugin then
    // can't read from disk (ENOENT ...preview.html?html-proxy&inline-css),
    // breaking `build:start`. Nothing reads HTML from server-asset storage at
    // runtime, so a Nitro module excludes *.html from the server-asset scan.
    nitro({
      // Vercel still needs its Build Output API preset, but VPS/Docker needs a
      // plain Node server in `.output`. Keep the deployment target explicit so
      // local and container builds don't accidentally inherit Vercel output.
      preset: process.env.NITRO_PRESET ?? (process.env.VERCEL ? "vercel" : "node-server"),
      // Nitro's `serverDir` defaults to `false` under the Vite integration, so
      // it never scans a `server/` dir. Enable it (→ "server") so the Vercel
      // cron endpoints at server/routes/api/cron/*.ts are discovered and bundled
      // into `.output` as routes `/api/cron/*`. TanStack Start v1.168 has no
      // server-route API of its own, so these raw HTTP handlers must live here.
      serverDir: true,
      modules: [
        (nitroInstance) => {
          for (const asset of nitroInstance.options.serverAssets) {
            asset.ignore = [...(asset.ignore ?? []), "**/*.html"];
          }
        },
      ],
    }),
  ],
  };
});
