import { PageShell } from "~/components/Core/PageShell";
import { ModelsCatalogue } from "~/components/Models/ModelsCatalogue";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";

export function meta() {
  return [
    { title: "Models - Polychat" },
    {
      name: "description",
      content:
        "Every model Polychat can reach, grouped by provider, with what each one takes in and how much context it holds. Pick one per message or leave it to Auto.",
    },
  ];
}

export default function Models() {
  return (
    <PageShell title="Models" sidebarContent={<StandardSidebarContent />} className="max-w-6xl">
      <ModelsCatalogue />
    </PageShell>
  );
}
