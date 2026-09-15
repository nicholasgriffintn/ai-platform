import { SidebarHeader as ControlledSidebarHeader } from "@ngriffin_uk/polychat-component-navigation";
import { APP_NAME, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { MODE_BASE_PATHS, useUIStore } from "@ngriffin_uk/polychat-library-react";
import type { ReactNode } from "react";

export interface SidebarHeaderProps {
  actions?: ReactNode;
}

export function SidebarHeader({ actions }: SidebarHeaderProps) {
  const { sidebarVisible, setSidebarVisible } = useUIStore();
  const setShowSearch = useChatStore((state) => state.setShowSearch);

  return (
    <ControlledSidebarHeader
      actions={actions}
      appName={APP_NAME}
      homeHref={MODE_BASE_PATHS.chat}
      sidebarVisible={sidebarVisible}
      onToggleSidebar={setSidebarVisible}
      onSearch={() => setShowSearch(true)}
    />
  );
}
