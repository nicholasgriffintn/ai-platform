import {
  PageShell,
  PublicAppsCatalogue,
  StandardSidebarContent,
} from "@ngriffin_uk/polychat-component-shell";

export default function DesktopAppsCataloguePage() {
  return (
    <PageShell title="Apps" sidebarContent={<StandardSidebarContent />} className="max-w-6xl">
      <PublicAppsCatalogue />
    </PageShell>
  );
}
