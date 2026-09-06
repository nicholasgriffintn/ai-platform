import { SidebarFooter as ControlledSidebarFooter } from "@ngriffin_uk/polychat-component-navigation";
import { cn } from "@ngriffin_uk/polychat-component-ui";
import { useTrackEvent, useUIStore } from "@ngriffin_uk/polychat-library-react";
import { Feather } from "lucide-react";

import { SidebarSettingsPopover } from "./SidebarSettingsPopover";

export function SidebarFooter() {
  const { trackEvent } = useTrackEvent();
  const showMetaAssistant = useUIStore((state) => state.showMetaAssistant);
  const setShowMetaAssistant = useUIStore((state) => state.setShowMetaAssistant);

  return (
    <ControlledSidebarFooter>
      <button
        type="button"
        aria-pressed={showMetaAssistant}
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-3 rounded-none border-b border-sidebar-border px-3 py-3 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:ring-2 focus:ring-sidebar-ring focus:outline-none focus:ring-inset",
          showMetaAssistant ? "bg-sidebar-accent text-sidebar-accent-foreground" : "bg-sidebar",
        )}
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
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-selection text-foreground">
            <Feather className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 truncate text-sm font-medium">Ask Poly</span>
        </span>
        <kbd className="shrink-0 text-[10px] font-medium text-muted-foreground">⌘J</kbd>
      </button>
      <SidebarSettingsPopover />
    </ControlledSidebarFooter>
  );
}
