import {
  StandardSidebarContent as ControlledStandardSidebarContent,
  SidebarNavButton,
  SidebarNavSection,
} from "@ngriffin_uk/polychat-component-navigation";
import { Search, SquarePen } from "lucide-react";

import { useStartNewChat } from "~/hooks/useStartNewChat";
import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";

import { DiscoverSidebarSection } from "./DiscoverSidebarSection";
import { PlacesNavLinks } from "./PlacesNavLinks";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";

export function StandardSidebarContent() {
  const { sidebarVisible, isMobile, setSidebarVisible } = useUIStore();
  const setShowSearch = useChatStore((state) => state.setShowSearch);
  const startNewChat = useStartNewChat();
  const closeOnMobile = () => {
    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  return (
    <ControlledStandardSidebarContent
      footer={<SidebarFooter />}
      header={<SidebarHeader />}
      homeHref="/"
      isMobile={isMobile}
      sidebarVisible={sidebarVisible}
      onClose={() => setSidebarVisible(false)}
    >
      <SidebarNavSection>
        <SidebarNavButton
          icon={<SquarePen size={17} />}
          onClick={() => {
            startNewChat();
            closeOnMobile();
          }}
        >
          New chat
        </SidebarNavButton>
        <SidebarNavButton
          icon={<Search size={17} />}
          onClick={() => setShowSearch(true)}
          shortcut="⌘K"
        >
          Search
        </SidebarNavButton>
        <PlacesNavLinks onNavigate={closeOnMobile} />
      </SidebarNavSection>
      <DiscoverSidebarSection onNavigate={closeOnMobile} />
    </ControlledStandardSidebarContent>
  );
}
