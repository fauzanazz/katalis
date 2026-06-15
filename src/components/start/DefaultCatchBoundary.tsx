import {
  ErrorComponent,
  rootRouteId,
  useMatch,
  useRouter,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { LocaleLink } from "@/i18n/start-navigation";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 p-4">
      <ErrorComponent error={error} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.invalidate()}
          className="rounded bg-gray-800 px-3 py-1 text-sm font-medium text-white"
        >
          Try Again
        </button>
        {isRoot ? (
          <LocaleLink
            href="/"
            className="rounded bg-gray-800 px-3 py-1 text-sm font-medium text-white"
          >
            Home
          </LocaleLink>
        ) : (
          <LocaleLink
            href="/"
            className="rounded bg-gray-800 px-3 py-1 text-sm font-medium text-white"
            onClick={(e) => {
              e.preventDefault();
              window.history.back();
            }}
          >
            Go Back
          </LocaleLink>
        )}
      </div>
    </div>
  );
}
