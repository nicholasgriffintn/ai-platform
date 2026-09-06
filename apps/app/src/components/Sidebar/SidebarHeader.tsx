import { SidebarHeader as ControlledSidebarHeader } from "@ngriffin_uk/polychat-component-navigation";
import { APP_NAME } from "@ngriffin_uk/polychat-library-client";
import type { ReactNode } from "react";

import { useUIStore } from "~/state/stores/uiStore";

interface SidebarHeaderProps {
  actions?: ReactNode;
}

export function SidebarHeader({ actions }: SidebarHeaderProps) {
  const { sidebarVisible, setSidebarVisible } = useUIStore();

  return (
    <ControlledSidebarHeader
      actions={actions}
      appName={APP_NAME}
      homeHref="/chat"
      sidebarVisible={sidebarVisible}
      onToggleSidebar={setSidebarVisible}
    />
  );
}
