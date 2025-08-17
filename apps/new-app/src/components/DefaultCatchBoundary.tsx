import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";

import { EmptyState } from "~/components/EmptyState";

function CatchBoundaryAction() {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <button
        onClick={() => {
          router.invalidate();
        }}
        className={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded text-white uppercase font-extrabold`}
      >
        Try Again
      </button>
      {isRoot ? (
        <Link
          to="/"
          className={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded text-white uppercase font-extrabold`}
        >
          Home
        </Link>
      ) : (
        <Link
          to="/"
          className={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded text-white uppercase font-extrabold`}
          onClick={(e) => {
            e.preventDefault();
            window.history.back();
          }}
        >
          Go Back
        </Link>
      )}
    </div>
  );
}

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  console.error("DefaultCatchBoundary Error:", error);

  return (
    <EmptyState action={<CatchBoundaryAction />}>
      <ErrorComponent error={error} />
    </EmptyState>
  );
}
