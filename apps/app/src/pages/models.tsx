import { PageShell, StandardSidebarContent } from "@ngriffin_uk/polychat-component-shell";

import { ModelsCatalogue } from "~/components/Models/ModelsCatalogue";
export function meta() {
  return [
    { title: "Models - Polychat" },
    {
      name: "description",
      content:
        "The models Polychat uses for each tier and system task, then every model it can reach grouped by provider. Pick one per message or pick a tier.",
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
