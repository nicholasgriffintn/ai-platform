import { PageShell, StandardSidebarContent } from "@ngriffin_uk/polychat-component-shell";

import { PublicAppsCatalogue } from "~/components/Capabilities/PublicAppsCatalogue";
export function meta() {
  return [
    { title: "Apps and teammates - Polychat" },
    {
      name: "description",
      content:
        "The apps Polychat ships with and the teammates you can hire, each with the ask already written so you can try one before signing up for anything.",
    },
  ];
}

export default function Apps() {
  return (
    <PageShell title="Apps" sidebarContent={<StandardSidebarContent />} className="max-w-6xl">
      <PublicAppsCatalogue />
    </PageShell>
  );
}
