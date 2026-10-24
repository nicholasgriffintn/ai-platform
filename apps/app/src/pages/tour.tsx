import { PageShell, StandardSidebarContent } from "@ngriffin_uk/polychat-component-shell";
import { DiscoverBands } from "@ngriffin_uk/polychat-component-shell/discover-bands";

export function meta() {
  return [
    { title: "Tour - Polychat" },
    {
      name: "description",
      content:
        "A short tour of Polychat: every model in one picker, capabilities beyond the reply, shared Work for projects, and credits that follow what you actually run.",
    },
  ];
}

export default function Tour() {
  return (
    <PageShell title="Tour" sidebarContent={<StandardSidebarContent />} className="max-w-6xl">
      <DiscoverBands variant="page" />
    </PageShell>
  );
}
