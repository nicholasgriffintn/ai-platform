import { PageShell } from "~/components/Core/PageShell";
import { PricingPage } from "~/components/Pricing/PricingPage";
import { StandardSidebarContent } from "~/components/Sidebar/StandardSidebarContent";

export function meta() {
  return [
    { title: "Pricing - Polychat" },
    {
      name: "description",
      content:
        "One pot of credits per month, spent on whatever you actually run. Bring your own keys and model usage costs nothing.",
    },
  ];
}

export default function Pricing() {
  return (
    <PageShell title="Pricing" sidebarContent={<StandardSidebarContent />}>
      <PricingPage />
    </PageShell>
  );
}
