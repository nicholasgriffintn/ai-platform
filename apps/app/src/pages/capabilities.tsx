import { PublicCapabilityCatalogue } from "~/components/Capabilities/PublicCapabilityCatalogue";
import { PageShell } from "~/components/Core/PageShell";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";

export function meta() {
  return [
    { title: "Capabilities - Polychat" },
    {
      name: "description",
      content:
        "Everything Polychat can do beyond a reply: built-in experiences, model tools, function tools and recipe templates, plus the agents, skills and recipes you curate yourself.",
    },
  ];
}

export default function Capabilities() {
  return (
    <PageShell
      title="Capabilities"
      sidebarContent={<StandardSidebarContent />}
      className="max-w-6xl"
    >
      <PublicCapabilityCatalogue />
    </PageShell>
  );
}
