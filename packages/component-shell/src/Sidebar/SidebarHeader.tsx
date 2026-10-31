import { SidebarHeader as ControlledSidebarHeader } from "@ngriffin_uk/polychat-component-navigation";
import { APP_NAME, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { DISCOVER_PATH, useUIStore } from "@ngriffin_uk/polychat-library-react";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";

export interface SidebarHeaderProps {
  actions?: ReactNode;
}

export function SidebarHeader({ actions }: SidebarHeaderProps) {
  const { sidebarVisible, setSidebarVisible } = useUIStore(
    useShallow((state) => ({
      sidebarVisible: state.sidebarVisible,
      setSidebarVisible: state.setSidebarVisible,
    })),
  );
  const setShowSearch = useChatStore((state) => state.setShowSearch);

  return (
    <ControlledSidebarHeader
      actions={actions}
      appName={APP_NAME}
      homeHref={DISCOVER_PATH}
      sidebarVisible={sidebarVisible}
      onToggleSidebar={setSidebarVisible}
      onSearch={() => setShowSearch(true)}
    />
  );
}
