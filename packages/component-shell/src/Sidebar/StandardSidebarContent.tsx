import {
  SidebarNavSection,
  StandardSidebarContent as ControlledStandardSidebarContent,
} from "@ngriffin_uk/polychat-component-navigation";
import { DISCOVER_PATH, useUIStore } from "@ngriffin_uk/polychat-library-react";
import { useShallow } from "zustand/react/shallow";

import { DiscoverSidebarSection } from "./DiscoverSidebarSection.js";
import { PlacesNavLinks } from "./PlacesNavLinks.js";
import { SidebarFooter } from "./SidebarFooter.js";
import { SidebarHeader } from "./SidebarHeader.js";
import { useSidebarPeekPanel } from "./SidebarPeekContext.js";

export function StandardSidebarContent() {
  const { sidebarVisible, isMobile, setSidebarVisible } = useUIStore(
    useShallow((state) => ({
      sidebarVisible: state.sidebarVisible,
      isMobile: state.isMobile,
      setSidebarVisible: state.setSidebarVisible,
    })),
  );
  const { peeking, panelProps } = useSidebarPeekPanel();
  const closeOnMobile = () => {
    if (isMobile) {
      setSidebarVisible(false);
    }
  };

  return (
    <ControlledStandardSidebarContent
      footer={<SidebarFooter />}
      header={<SidebarHeader />}
      homeHref={DISCOVER_PATH}
      isMobile={isMobile}
      sidebarVisible={sidebarVisible}
      peeking={peeking}
      peekProps={panelProps}
      onClose={() => setSidebarVisible(false)}
    >
      <SidebarNavSection>
        <PlacesNavLinks onNavigate={closeOnMobile} />
      </SidebarNavSection>
      <DiscoverSidebarSection onNavigate={closeOnMobile} />
    </ControlledStandardSidebarContent>
  );
}
