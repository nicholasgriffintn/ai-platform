import { SidebarNavLink, SidebarNavSection } from "@ngriffin_uk/polychat-component-navigation";
import { Compass, PawPrint, WalletCards } from "lucide-react";

import { DISCOVER_PATH } from "~/components/Discover/discover-sections";

export function DiscoverSidebarSection({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <SidebarNavSection title="Discover">
      <SidebarNavLink href={DISCOVER_PATH} end icon={<Compass size={16} />} onClick={onNavigate}>
        Tour
      </SidebarNavLink>
      <SidebarNavLink href="/pets" end icon={<PawPrint size={16} />} onClick={onNavigate}>
        Pets
      </SidebarNavLink>
      <SidebarNavLink href="/pricing" end icon={<WalletCards size={16} />} onClick={onNavigate}>
        Pricing
      </SidebarNavLink>
    </SidebarNavSection>
  );
}
