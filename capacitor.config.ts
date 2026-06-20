import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor native shell for Katalis.
 *
 * Strategy: **server-mode WebView**. The native iOS/Android app is a thin shell
 * whose WebView loads the deployed Katalis web app (TanStack Start SSR). Because
 * the WebView shares an origin with the live site, everything works unchanged —
 * cookie auth, `createServerFn` server functions, SSR, and the /en|/id|/zh
 * locale URL routing. There is no separate client bundle to maintain.
 *
 * The target is env-driven and baked into the native project at `cap sync` time:
 *   - prod (default): https://katalis.app
 *   - staging:        CAP_SERVER_URL=https://<preview>.vercel.app bun cap:sync
 *   - LAN dev:        CAP_SERVER_URL=http://192.168.x.x:3101 bun cap:sync
 *                     (cleartext HTTP is auto-enabled for http:// URLs)
 *
 * NOTE: a pure WebView wrap can trip Apple App Store guideline 4.2 (minimum
 * functionality). Before store submission, add native capability via Capacitor
 * plugins (push notifications, camera, share) and an offline shell.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "https://katalis.app";
const allowCleartext = process.env.CAP_CLEARTEXT === "1" || serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "app.katalis",
  appName: "Katalis",
  // Required by the CLI even in server-mode: `cap copy` bundles this directory
  // as the local fallback shell (shown while the remote URL is loading or when
  // it is unreachable). See mobile/www/index.html.
  webDir: "mobile/www",
  server: {
    url: serverUrl,
    cleartext: allowCleartext,
  },
};

export default config;
