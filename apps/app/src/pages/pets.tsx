import { PageShell } from "~/components/Core/PageShell";
import { PetShowcase } from "~/components/Pets/PetShowcase";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";

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
    <PageShell title="Pets" sidebarContent={<StandardSidebarContent />}>
      <PetShowcase />
    </PageShell>
  );
}
