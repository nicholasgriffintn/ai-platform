import {
  SidebarNavButton,
  SidebarNavSection,
  StandardSidebarContent as ControlledStandardSidebarContent,
} from "@ngriffin_uk/polychat-component-navigation";
import { MODE_BASE_PATHS, useStartNewChat, useUIStore } from "@ngriffin_uk/polychat-library-react";
import { SquarePen } from "lucide-react";

import { DiscoverSidebarSection } from "./DiscoverSidebarSection.js";
import { PlacesNavLinks } from "./PlacesNavLinks.js";
import { SidebarFooter } from "./SidebarFooter.js";
import { SidebarHeader } from "./SidebarHeader.js";
import { useSidebarPeekPanel } from "./SidebarPeekContext.js";

export function StandardSidebarContent() {
  const { sidebarVisible, isMobile, setSidebarVisible } = useUIStore();
  const { peeking, panelProps } = useSidebarPeekPanel();
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
      homeHref={MODE_BASE_PATHS.chat}
      isMobile={isMobile}
      sidebarVisible={sidebarVisible}
      peeking={peeking}
      peekProps={panelProps}
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
        <PlacesNavLinks onNavigate={closeOnMobile} />
      </SidebarNavSection>
      <DiscoverSidebarSection onNavigate={closeOnMobile} />
    </ControlledStandardSidebarContent>
  );
}
