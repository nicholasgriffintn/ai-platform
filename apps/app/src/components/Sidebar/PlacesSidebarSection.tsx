import { SidebarNavLink, SidebarNavSection } from "@ngriffin_uk/polychat-component-navigation";
import { BellRing, FolderOpen, UsersRound } from "lucide-react";

import { PLACE_PATHS } from "~/lib/navigation/places";

export function PlacesSidebarSection({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <SidebarNavSection>
      <SidebarNavLink
        href={PLACE_PATHS.attention}
        icon={<BellRing size={16} />}
        onClick={onNavigate}
      >
        Attention
      </SidebarNavLink>
      <SidebarNavLink href={PLACE_PATHS.files} icon={<FolderOpen size={16} />} onClick={onNavigate}>
        Files
      </SidebarNavLink>
      <SidebarNavLink
        href={PLACE_PATHS.library}
        icon={<UsersRound size={16} />}
        onClick={onNavigate}
      >
        Teammates
      </SidebarNavLink>
    </SidebarNavSection>
  );
}
