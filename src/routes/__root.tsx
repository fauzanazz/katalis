/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

import { DefaultCatchBoundary } from "@/components/start/DefaultCatchBoundary";
import { StartNotFound } from "@/components/start/StartNotFound";
import { Toaster } from "@/components/start/Toaster";
import { getLocale } from "@/paraglide/runtime";
import { m } from "@/paraglide/messages";
import appCss from "@/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: m.metadata_title() },
      { name: "description", content: m.metadata_description() },
    ],
    links: [
      // Webfonts self-hosted via src/styles/fonts.css (woff2 in public/fonts).
      // The Google Fonts <link> was removed: render-blocking + GFW-blocked in China.
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <StartNotFound />,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang={getLocale()} className="h-full antialiased">
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <div className="flex min-h-dvh flex-col">{children}</div>
        <Toaster />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
