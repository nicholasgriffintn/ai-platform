import { Link } from "@tanstack/react-router";

import { EmptyState } from "~/components/EmptyState";

function NotFoundAction() {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <button
        onClick={() => window.history.back()}
        className="bg-emerald-500 text-white px-2 py-1 rounded uppercase font-black text-sm"
      >
        Go back
      </button>
      <Link
        to="/"
        className="bg-cyan-600 text-white px-2 py-1 rounded uppercase font-black text-sm"
      >
        Start Over
      </Link>
    </div>
  );
}

export function NotFound({ children }: { children?: any }) {
  return (
    <EmptyState
      title="Page Not Found"
      message="The page you are looking for does not exist."
      action={<NotFoundAction />}
    >
      {children}
    </EmptyState>
  );
}
