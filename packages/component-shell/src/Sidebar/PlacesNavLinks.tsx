import { SidebarNavLink } from "@ngriffin_uk/polychat-component-navigation";
import { getPlacePaths, type ProductMode } from "@ngriffin_uk/polychat-library-react";
import { polyPlaceAnchor } from "@ngriffin_uk/polychat-schemas";
import {
  BellRing,
  CalendarClock,
  FolderOpen,
  LayoutTemplate,
  Plug,
  Sunrise,
  UsersRound,
} from "lucide-react";

import { useInboxNeedsYou } from "../Attention/useInboxNeedsYou.js";

export function PlacesNavLinks({
  mode = "chat",
  onNavigate,
}: {
  mode?: ProductMode;
  onNavigate?: () => void;
}) {
  const places = getPlacePaths(mode);
  const needsYou = useInboxNeedsYou();

  return (
    <>
      {mode === "chat" && (
        <SidebarNavLink
          anchor={polyPlaceAnchor("discover")}
          href={places.discover}
          icon={<Sunrise size={16} />}
          onClick={onNavigate}
        >
          Discover
        </SidebarNavLink>
      )}
      <SidebarNavLink
        anchor={polyPlaceAnchor("attention")}
        href={places.attention}
        icon={<BellRing size={16} />}
        count={needsYou}
        countLabel={`${needsYou} waiting on you`}
        onClick={onNavigate}
      >
        Inbox
      </SidebarNavLink>
      <SidebarNavLink
        anchor={polyPlaceAnchor("sites")}
        href={places.sites}
        icon={<LayoutTemplate size={16} />}
        onClick={onNavigate}
      >
        Sites
      </SidebarNavLink>
      <SidebarNavLink
        anchor={polyPlaceAnchor("files")}
        href={places.files}
        icon={<FolderOpen size={16} />}
        onClick={onNavigate}
      >
        Files
      </SidebarNavLink>
      <SidebarNavLink
        anchor={polyPlaceAnchor("teammates")}
        href={places.teammates}
        icon={<UsersRound size={16} />}
        onClick={onNavigate}
      >
        Teammates
      </SidebarNavLink>
      <SidebarNavLink
        anchor={polyPlaceAnchor("scheduled")}
        href={places.scheduled}
        icon={<CalendarClock size={16} />}
        onClick={onNavigate}
      >
        Scheduled
      </SidebarNavLink>
      <SidebarNavLink
        anchor={polyPlaceAnchor("plugins")}
        href={places.plugins}
        icon={<Plug size={16} />}
        onClick={onNavigate}
      >
        Plugins
      </SidebarNavLink>
    </>
  );
}
