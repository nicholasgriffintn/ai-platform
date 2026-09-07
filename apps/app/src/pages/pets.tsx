import { PageShell, StandardSidebarContent } from "@ngriffin_uk/polychat-component-shell";

import { PetShowcase } from "~/components/Pets/PetShowcase";
export function meta() {
  return [
    { title: "Pets - Polychat" },
    {
      name: "description",
      content:
        "The Polychat pets: four parrots that used to be logos, and four strays that turned up on their own.",
    },
  ];
}

export default function PetsPage() {
  return (
    <PageShell title="Pets" sidebarContent={<StandardSidebarContent />} className="max-w-6xl">
      <PetShowcase />
    </PageShell>
  );
}
