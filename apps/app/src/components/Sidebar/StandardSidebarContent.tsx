import { StandardSidebarContent as ControlledStandardSidebarContent } from "@ngriffin_uk/polychat-component-navigation";

import { useUIStore } from "~/state/stores/uiStore";

import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";

export function StandardSidebarContent() {
  const { sidebarVisible, isMobile, setSidebarVisible } = useUIStore();

  return (
    <ControlledStandardSidebarContent
      footer={<SidebarFooter />}
      header={<SidebarHeader />}
      homeHref="/"
      isMobile={isMobile}
      sidebarVisible={sidebarVisible}
      onClose={() => setSidebarVisible(false)}
    />
  );
}
