import { PageShell } from "~/components/Core/PageShell";
import { DiscoverBands } from "~/components/Discover/DiscoverBands";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";

export function meta() {
  return [
    { title: "Discover - Polychat" },
    {
      name: "description",
      content:
        "A short tour of Polychat: every model in one picker, capabilities beyond the reply, shared Work for projects, and credits that follow what you actually run.",
    },
  ];
}

export default function Discover() {
  return (
    <PageShell title="Discover" sidebarContent={<StandardSidebarContent />} className="max-w-6xl">
      <DiscoverBands variant="page" />
    </PageShell>
  );
}
