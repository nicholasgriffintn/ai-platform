import { PageShell } from "~/components/PageShell";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";

export function meta() {
  return [
    { title: "404 - Page Not Found" },
    { name: "description", content: "Page not found" },
  ];
}

export default function CatchAllRoute() {
  return (
    <PageShell
      title="Page Not Found"
      sidebarContent={<StandardSidebarContent />}
    >
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-zinc-500 dark:text-zinc-400">Page not found</p>
      </div>
    </PageShell>
  );
}
