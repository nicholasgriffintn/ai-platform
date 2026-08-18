import { NavbarSidebarToggle } from "@ngriffin_uk/polychat-component-navigation";

import { useUIStore } from "~/state/stores/uiStore";

interface ChatNavbarProps {
  showSidebarToggle?: boolean;
}

export const ChatNavbar = ({ showSidebarToggle = true }: ChatNavbarProps) => {
  const { isMobile, sidebarVisible, setSidebarVisible } = useUIStore();

  if (!showSidebarToggle) {
    return null;
  }

  return (
    <NavbarSidebarToggle
      isMobile={isMobile}
      sidebarVisible={sidebarVisible}
      onToggleSidebar={setSidebarVisible}
    />
  );
};
