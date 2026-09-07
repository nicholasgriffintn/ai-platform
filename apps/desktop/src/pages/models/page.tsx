import {
  ModelsCatalogue,
  PageShell,
  StandardSidebarContent,
} from "@ngriffin_uk/polychat-component-shell";

export default function DesktopModelsPage() {
  return (
    <PageShell title="Models" sidebarContent={<StandardSidebarContent />} className="max-w-6xl">
      <ModelsCatalogue />
    </PageShell>
  );
}
