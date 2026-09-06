import { SidebarNavLink } from "@ngriffin_uk/polychat-component-navigation";
import { BellRing, FolderOpen, UsersRound } from "lucide-react";

import { getPlacePaths, type ProductMode } from "~/lib/navigation/places";

export function PlacesNavLinks({
  mode = "chat",
  onNavigate,
}: {
  mode?: ProductMode;
  onNavigate?: () => void;
}) {
  const places = getPlacePaths(mode);

  return (
    <>
      <SidebarNavLink href={places.attention} icon={<BellRing size={16} />} onClick={onNavigate}>
        Attention
      </SidebarNavLink>
      <SidebarNavLink href={places.files} icon={<FolderOpen size={16} />} onClick={onNavigate}>
        Files
      </SidebarNavLink>
      <SidebarNavLink href={places.teammates} icon={<UsersRound size={16} />} onClick={onNavigate}>
        Teammates
      </SidebarNavLink>
    </>
  );
}
