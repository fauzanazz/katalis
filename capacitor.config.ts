import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor native shell for Katalis — **offline-first bundled build**.
 *
 * The app must run in mainland China with no self-hosted backend (no online
 * host, so no ICP filing). So the native app bundles a fully static client SPA
 * (built by `vite.offline.config.mts` → offline/dist) into the APK and serves
 * it from https://localhost — zero network needed to launch and use the core
 * experience. Dynamic AI (mentor) is called directly from the client to Google
 * Gemini when a connection is available, and degrades gracefully offline.
 *
 * Dev live-reload (optional): point the WebView at the running offline dev
 * server instead of the bundled assets —
 *   CAP_SERVER_URL=http://192.168.x.x:5173 bun cap:sync
 * (cleartext HTTP is auto-enabled for http:// URLs). Unset = bundled offline.
 */
const devServerUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "app.katalis",
  appName: "Katalis",
  // The bundled offline SPA. Run `bun run build:offline` before `cap sync`.
  webDir: "offline/dist",
  ...(devServerUrl
    ? {
        server: {
          url: devServerUrl,
          cleartext: process.env.CAP_CLEARTEXT === "1" || devServerUrl.startsWith("http://"),
        },
      }
    : {}),
};

export default config;
