import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function StartNotFound({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="text-gray-600">
        {children ?? <p>The page you are looking for does not exist.</p>}
      </div>
      <Link
        to="/"
        className="rounded bg-gray-800 px-3 py-1 text-sm font-medium text-white"
      >
        Home
      </Link>
    </div>
  );
}
