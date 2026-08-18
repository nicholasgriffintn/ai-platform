import { PageStatus } from "@ngriffin_uk/polychat-component-ui";
import { Link } from "react-router";

import { Logo } from "~/components/Core/Logo";
import { PageShell } from "~/components/Core/PageShell";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";

export function meta() {
  return [{ title: "404 - Page Not Found" }, { name: "description", content: "Page not found" }];
}

export default function CatchAllRoute() {
  return (
    <PageShell title="Page Not Found" sidebarContent={<StandardSidebarContent />}>
      <PageStatus
        icon={
          <div className="h-24 w-24 animate-bob motion-reduce:animate-none">
            <Logo variant="logo_minimalist" />
          </div>
        }
        title="This page has flown off."
        message="Whatever perched here has moved on. Check the URL, or head back somewhere familiar."
        className="h-full"
      >
        <Link
          to="/"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 no-underline"
        >
          Back to the nest
        </Link>
      </PageStatus>
    </PageShell>
  );
}
