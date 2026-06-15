import {
  Link,
  useLocation,
  useNavigate,
  useRouter,
  type LinkComponentProps,
} from "@tanstack/react-router";

import { getLocale, isLocale } from "@/paraglide/runtime";

/**
 * Navigation primitives for the TanStack Start app, mirroring the next-intl
 * `@/i18n/navigation` API surface so chrome/pages port with minimal churn.
 *
 * All app routes live under the `$locale` file-route, so links/navigation must
 * thread the active locale into the `locale` route param. `href` props are the
 * locale-stripped path (e.g. "/discover", "/"), matching next-intl semantics.
 */

// "/discover" -> "/$locale/discover"; "/" -> "/$locale". The dynamic template +
// `params` is resolved against the route tree at runtime by TanStack Router.
function buildTo(href: string): string {
  return href === "/" ? "/$locale" : `/$locale${href}`;
}

export type LocaleLinkProps = Omit<
  LinkComponentProps<"a">,
  "to" | "params" | "from"
> & {
  href: string;
};

export function LocaleLink({ href, ...props }: LocaleLinkProps) {
  const locale = getLocale();
  return (
    <Link
      to={buildTo(href) as LinkComponentProps<"a">["to"]}
      params={{ locale } as never}
      {...props}
    />
  );
}

/** Locale-stripped pathname (e.g. "/id/discover" -> "/discover", "/id" -> "/"). */
export function useLocalePathname(): string {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0])) segments.shift();
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

/** Programmatic navigation that auto-threads the active locale. */
export function useLocaleRouter() {
  const navigate = useNavigate();
  const router = useRouter();
  return {
    push: (href: string) =>
      navigate({
        to: buildTo(href) as never,
        params: { locale: getLocale() } as never,
      }),
    back: () => router.history.back(),
    refresh: () => router.invalidate(),
  };
}
