import { NavbarSidebarToggle } from "@ngriffin_uk/polychat-component-navigation";
import { useUIStore } from "@ngriffin_uk/polychat-library-react";

import { useSidebarPeekTrigger } from "../Sidebar/SidebarPeekContext.js";

export interface ChatNavbarProps {
  showSidebarToggle?: boolean;
}

export function ChatNavbar({ showSidebarToggle = true }: ChatNavbarProps) {
  const { isMobile, sidebarVisible, setSidebarVisible } = useUIStore();
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
    />
  );
}
