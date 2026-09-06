import {
  SidebarFooter as ControlledSidebarFooter,
  SidebarNavButton,
} from "@ngriffin_uk/polychat-component-navigation";
import { Feather } from "lucide-react";

import { useTrackEvent } from "~/hooks/use-track-event";
import { useUIStore } from "~/state/stores/uiStore";

import { SidebarSettingsPopover } from "./SidebarSettingsPopover";

export function SidebarFooter() {
  const { trackEvent } = useTrackEvent();
  const showMetaAssistant = useUIStore((state) => state.showMetaAssistant);
  const setShowMetaAssistant = useUIStore((state) => state.setShowMetaAssistant);

  return (
    <ControlledSidebarFooter>
      <div className="border-sidebar-border border-b px-2 py-1.5">
        <SidebarNavButton
          icon={<Feather size={16} />}
          isActive={showMetaAssistant}
          shortcut="⌘J"
          onClick={() => {
            trackEvent({
              name: "open_meta_assistant",
              category: "navigation",
              label: "sidebar_footer",
              value: 1,
            });
            setShowMetaAssistant(true);
          }}
        >
          Ask Poly
        </SidebarNavButton>
      </div>
      <SidebarSettingsPopover />
    </ControlledSidebarFooter>
  );
}
