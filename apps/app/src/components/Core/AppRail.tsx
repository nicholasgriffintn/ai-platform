import {
  ProductRail,
  type ProductRailItem,
  type ProductRailOrientation,
} from "@ngriffin_uk/polychat-component-navigation";
import {
  BellRing,
  BriefcaseBusiness,
  Feather,
  FolderOpen,
  MessageCircle,
  Settings2,
  UserRound,
} from "lucide-react";
import { useLocation } from "react-router";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useTaskAttention } from "~/hooks/useProjectTasks";
import { getActivePlace, PLACE_PATHS } from "~/lib/navigation/places";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

export function AppRail({ orientation }: { orientation: ProductRailOrientation }) {
  const { pathname } = useLocation();
  const { trackEvent } = useTrackEvent();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const setShowMetaAssistant = useUIStore((state) => state.setShowMetaAssistant);
  const showMetaAssistant = useUIStore((state) => state.showMetaAssistant);
  const { items: attentionItems } = useTaskAttention();
  const activePlace = getActivePlace(pathname);
  const iconSize = 18;

  const items: ProductRailItem[] = [
    {
      id: "chat",
      label: "Chat",
      icon: <MessageCircle size={iconSize} />,
      href: PLACE_PATHS.chat,
      isActive: activePlace === "chat",
    },
    {
      id: "work",
      label: "Work",
      icon: <BriefcaseBusiness size={iconSize} />,
      href: PLACE_PATHS.work,
      isActive: activePlace === "work",
    },
    {
      id: "attention",
      label: "Attention",
      icon: <BellRing size={iconSize} />,
      href: PLACE_PATHS.attention,
      isActive: activePlace === "attention",
      badge: isAuthenticated ? attentionItems.length : undefined,
    },
    {
      id: "files",
      label: "Files",
      icon: <FolderOpen size={iconSize} />,
      href: PLACE_PATHS.files,
      isActive: activePlace === "files",
    },
    {
      id: "library",
      label: "Teammates",
      icon: <Settings2 size={iconSize} />,
      href: PLACE_PATHS.library,
      isActive: activePlace === "library",
    },
  ];

  const footerItems: ProductRailItem[] = [
    {
      id: "poly",
      label: "Poly",
      icon: <Feather size={iconSize} />,
      shortcut: "⌘J",
      isActive: showMetaAssistant,
      onClick: () => {
        trackEvent({
          name: "open_meta_assistant",
          category: "navigation",
          label: "rail",
          value: 1,
        });
        setShowMetaAssistant(true);
      },
    },
    {
      id: "you",
      label: "You",
      icon: <UserRound size={iconSize} />,
      href: PLACE_PATHS.you,
      isActive: activePlace === "you",
    },
  ];

  return (
    <ProductRail
      items={items}
      footerItems={footerItems}
      orientation={orientation}
      className={orientation === "vertical" ? "h-full" : undefined}
    />
  );
}
