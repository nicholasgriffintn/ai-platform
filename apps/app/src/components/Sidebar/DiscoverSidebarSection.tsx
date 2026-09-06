import { SidebarNavLink, SidebarNavSection } from "@ngriffin_uk/polychat-component-navigation";
import { Compass, Cpu, PawPrint, Puzzle, WalletCards } from "lucide-react";

import { DISCOVER_PATH } from "~/components/Discover/discover-sections";

export function DiscoverSidebarSection({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <SidebarNavSection title="Discover">
      <SidebarNavLink href={DISCOVER_PATH} end icon={<Compass size={16} />} onClick={onNavigate}>
        Tour
      </SidebarNavLink>
      <SidebarNavLink href="/models" end icon={<Cpu size={16} />} onClick={onNavigate}>
        Models
      </SidebarNavLink>
      <SidebarNavLink href="/capabilities" end icon={<Puzzle size={16} />} onClick={onNavigate}>
        Capabilities
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
