import { SidebarNavLink } from "@ngriffin_uk/polychat-component-navigation";
import { getPlacePaths, type ProductMode } from "@ngriffin_uk/polychat-library-react";
import { BellRing, CalendarClock, FolderOpen, Palette, Plug, UsersRound } from "lucide-react";

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
      <SidebarNavLink href={places.canvas} icon={<Palette size={16} />} onClick={onNavigate}>
        Canvas
      </SidebarNavLink>
      <SidebarNavLink href={places.files} icon={<FolderOpen size={16} />} onClick={onNavigate}>
        Files
      </SidebarNavLink>
      <SidebarNavLink href={places.teammates} icon={<UsersRound size={16} />} onClick={onNavigate}>
        Teammates
      </SidebarNavLink>
      <SidebarNavLink
        href={places.scheduled}
        icon={<CalendarClock size={16} />}
        onClick={onNavigate}
      >
        Scheduled
      </SidebarNavLink>
      <SidebarNavLink href={places.plugins} icon={<Plug size={16} />} onClick={onNavigate}>
        Plugins
      </SidebarNavLink>
    </>
  );
}
