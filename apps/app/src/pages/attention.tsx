import { PageShell } from "~/components/Core/PageShell";
import { AttentionPage } from "~/components/Work/AttentionPage";

export function meta() {
  return [
    { title: "Attention - Polychat" },
    {
      name: "description",
      content: "Everything waiting on you across Chat and every workspace you can access.",
    },
  ];
}

export default function GlobalAttentionPage() {
  return (
    <PageShell title="Attention" fullBleed displayNavBar={false}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div data-header-scroll-source className="min-h-0 flex-1 overflow-y-auto">
          <AttentionPage />
        </div>
      </div>
    </PageShell>
  );
}
