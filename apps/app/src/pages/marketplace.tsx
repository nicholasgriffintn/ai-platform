import { Marketplace } from "~/components/Marketplace";
import { PageShell } from "~/components/PageShell";
import { StandardSidebarContent } from "~/components/StandardSidebarContent";

export function meta() {
  return [
    { title: "Agent Marketplace | Polychat" },
    {
      name: "description",
      content:
        "Discover and install powerful AI agents created by the community. Find specialized assistants for coding, writing, analysis, and more.",
    },
  ];
}

export default function MarketplacePage() {
  return (
    <PageShell sidebarContent={<StandardSidebarContent />} isBeta={true}>
      <Marketplace />
    </PageShell>
  );
}
