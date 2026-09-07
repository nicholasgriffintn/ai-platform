import {
  DiscoverBands,
  PageShell,
  StandardSidebarContent,
} from "@ngriffin_uk/polychat-component-shell";

export default function DesktopDiscoverPage() {
  return (
    <PageShell title="Discover" sidebarContent={<StandardSidebarContent />} className="max-w-6xl">
      <DiscoverBands variant="page" />
    </PageShell>
  );
}
