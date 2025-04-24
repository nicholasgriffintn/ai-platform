import { PageShell } from "~/components/PageShell";
import { PageStatus } from "~/components/PageStatus";
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
      <PageStatus
        message="Sorry, this page doesn't exist. Please check the URL and try again."
        className="h-full"
      />
    </PageShell>
  );
}
