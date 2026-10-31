import { NavbarSidebarToggle } from "@ngriffin_uk/polychat-component-navigation";
import { useUIStore } from "@ngriffin_uk/polychat-library-react";
import { useShallow } from "zustand/react/shallow";

import { MediaDockHeaderChip } from "../Media/MediaDock.js";
import { useSidebarPeekTrigger } from "../Sidebar/SidebarPeekContext.js";

export interface ChatNavbarProps {
  showSidebarToggle?: boolean;
}

export function ChatNavbar({ showSidebarToggle = true }: ChatNavbarProps) {
  const { isMobile, sidebarVisible, setSidebarVisible } = useUIStore(
    useShallow((state) => ({
      isMobile: state.isMobile,
      sidebarVisible: state.sidebarVisible,
      setSidebarVisible: state.setSidebarVisible,
    })),
  );
  const sidebarPeekTrigger = useSidebarPeekTrigger();

  if (!showSidebarToggle) {
    return null;
  }

  return (
    <NavbarSidebarToggle
      isMobile={isMobile}
      sidebarVisible={sidebarVisible}
      onToggleSidebar={setSidebarVisible}
      peekProps={sidebarPeekTrigger}
      actions={<MediaDockHeaderChip />}
    />
  );
}
