import { createMiddleware, createStart } from "@tanstack/react-start";

import { paraglideMiddleware } from "@/paraglide/server";

/**
 * Global request middleware: resolve the active locale from the URL (/en, /id,
 * /zh) and run the rest of the request inside Paraglide's AsyncLocalStorage
 * context, so `getLocale()` / `m.*()` return the correct locale during SSR.
 *
 * We ignore Paraglide's de-localized request and let the router match the
 * original prefixed URL — the route tree lives under `$locale`.
 */
const localeMiddleware = createMiddleware({ type: "request" }).server(
  ({ request, next }) =>
    paraglideMiddleware(request, async () => {
      const { response } = await next();
      return response;
    }),
);

export const startInstance = createStart(() => ({
  requestMiddleware: [localeMiddleware],
}));
