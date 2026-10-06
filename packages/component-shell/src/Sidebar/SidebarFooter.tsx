import { SidebarFooter as ControlledSidebarFooter } from "@ngriffin_uk/polychat-component-navigation";
import { cn } from "@ngriffin_uk/polychat-component-ui";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { usePolyPresence, useTrackEvent, useUIStore } from "@ngriffin_uk/polychat-library-react";
import { Feather } from "lucide-react";

import { useShellHost } from "../Host/ShellHostContext.js";
import { SidebarSettingsPopover } from "./SidebarSettingsPopover.js";

export function SidebarFooter() {
  const { trackEvent } = useTrackEvent();
  const { openAssistant } = useShellHost();
  const showPoly = useUIStore((state) => state.showPoly);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const presence = usePolyPresence(isAuthenticated);
  const hasActivity = Boolean(presence && (presence.needsYou > 0 || presence.workingOn > 0));

  return (
    <ControlledSidebarFooter>
      <button
        type="button"
        aria-pressed={showPoly}
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-3 rounded-none border-b border-sidebar-border px-3 py-3 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:ring-2 focus:ring-sidebar-ring focus:outline-none focus:ring-inset",
          showPoly ? "bg-sidebar-accent text-sidebar-accent-foreground" : "bg-sidebar",
        )}
        onClick={() => {
          trackEvent({
            name: "open_poly",
            category: "navigation",
            label: "sidebar_footer",
            value: 1,
          });
          openAssistant();
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-selection text-foreground">
            <Feather className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">Ask Poly</span>
            {presence && hasActivity ? (
              <span
                className={cn(
                  "truncate text-xs",
                  presence.needsYou > 0 ? "text-human-action" : "text-muted-foreground",
                )}
              >
                {presence.status}
              </span>
            ) : null}
          </span>
        </span>
        <kbd className="shrink-0 text-[10px] font-medium text-muted-foreground">⌘J</kbd>
      </button>
      <SidebarSettingsPopover />
    </ControlledSidebarFooter>
  );
}
