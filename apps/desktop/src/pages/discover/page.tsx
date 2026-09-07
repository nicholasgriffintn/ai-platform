import { PageShell, StandardSidebarContent } from "@ngriffin_uk/polychat-component-shell";
import { DiscoverBands } from "@ngriffin_uk/polychat-component-shell/discover-bands";

export default function DesktopDiscoverPage() {
  return (
    <PageShell title="Discover" sidebarContent={<StandardSidebarContent />} className="max-w-6xl">
      <DiscoverBands variant="page" />
    </PageShell>
  );
}
