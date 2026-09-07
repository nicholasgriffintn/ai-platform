import {
  PageShell,
  PricingPage,
  StandardSidebarContent,
} from "@ngriffin_uk/polychat-component-shell";

export default function DesktopPricingPage() {
  return (
    <PageShell title="Pricing" sidebarContent={<StandardSidebarContent />}>
      <PricingPage />
    </PageShell>
  );
}
