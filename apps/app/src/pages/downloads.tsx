import { PageShell } from "~/components/Core/PageShell";
import { DownloadsPage } from "~/components/Downloads/DownloadsPage";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";

export function meta() {
  return [
    { title: "Downloads - Polychat" },
    {
      name: "description",
      content:
        "Install Polychat on macOS, Windows or Linux, and run models on your own machine alongside the hosted catalogue.",
    },
  ];
}

export default function Downloads() {
  return (
    <PageShell title="Downloads" sidebarContent={<StandardSidebarContent />}>
      <DownloadsPage />
    </PageShell>
  );
}
