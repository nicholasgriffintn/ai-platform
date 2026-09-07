import {
  PageShell,
  PetShowcase,
  StandardSidebarContent,
} from "@ngriffin_uk/polychat-component-shell";

export default function DesktopPetsPage() {
  return (
    <PageShell title="Pets" sidebarContent={<StandardSidebarContent />} className="max-w-6xl">
      <PetShowcase />
    </PageShell>
  );
}
