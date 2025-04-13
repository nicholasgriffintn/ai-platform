import { Cloud, CloudOff, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "~/components/ui";
import { useChatStore } from "~/state/stores/chatStore";

interface SidebarHeaderProps {
  showCloudButton?: boolean;
  onToggleLocalOnlyMode?: () => void;
}

// This component ONLY renders the header section's JSX
export function SidebarHeader({
  showCloudButton = true,
  onToggleLocalOnlyMode,
}: SidebarHeaderProps) {
  const {
    sidebarVisible,
    setSidebarVisible,
    isAuthenticated,
    localOnlyMode,
    setLocalOnlyMode, // Needed for fallback toggle
  } = useChatStore();

  // Use passed handler or fallback to internal toggle
  const toggleLocalOnlyModeHandler = onToggleLocalOnlyMode
    ? onToggleLocalOnlyMode
    : () => {
        const newMode = !localOnlyMode;
        setLocalOnlyMode(newMode);
        if (window.localStorage) {
          window.localStorage.setItem("localOnlyMode", String(newMode));
        }
      };

  return (
    // Copied directly from ChatSidebar's header structure
    <div className="sticky top-0 bg-off-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 md:border-r z-10 w-full h-[53px]">
      <div className="mx-2 my-2 flex items-center justify-between h-[37px]">
        <Button
          type="button"
          variant="icon"
          title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          icon={
            sidebarVisible ? (
              <PanelLeftClose size={20} />
            ) : (
              <PanelLeftOpen size={20} />
            )
          }
          onClick={() => setSidebarVisible(!sidebarVisible)}
        />
        <div className="flex items-center gap-2">
          {showCloudButton && isAuthenticated && (
            <Button
              type="button"
              variant={localOnlyMode ? "iconActive" : "icon"}
              title={
                localOnlyMode
                  ? "Switch to cloud mode"
                  : "Switch to local-only mode"
              }
              aria-label={
                localOnlyMode
                  ? "Switch to cloud mode"
                  : "Switch to local-only mode"
              }
              icon={
                localOnlyMode ? <CloudOff size={20} /> : <Cloud size={20} />
              }
              onClick={toggleLocalOnlyModeHandler}
            />
          )}
        </div>
      </div>
    </div>
  );
}
