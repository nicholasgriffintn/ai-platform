import { SidebarFooter as ControlledSidebarFooter } from "@ngriffin_uk/polychat-component-navigation";

import { SidebarSettingsPopover } from "./SidebarSettingsPopover";

export function SidebarFooter() {
  return (
    <ControlledSidebarFooter>
      <SidebarSettingsPopover />
    </ControlledSidebarFooter>
  );
}
