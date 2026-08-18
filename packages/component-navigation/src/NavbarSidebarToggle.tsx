import { Button } from "@ngriffin_uk/polychat-component-ui";
import { Menu, PanelLeftOpen } from "lucide-react";

export interface NavbarSidebarToggleProps {
  isMobile: boolean;
  sidebarVisible: boolean;
  onToggleSidebar: (visible: boolean) => void;
}

export function NavbarSidebarToggle({
  isMobile,
  sidebarVisible,
  onToggleSidebar,
}: NavbarSidebarToggleProps) {
  return (
    <div className="sticky top-0 bg-off-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 z-10 w-full">
      <div className="m-2 flex items-center justify-between max-w-full">
        <div className="flex items-center min-w-0">
          <div className="flex-shrink-0">
            <Button
              type="button"
              variant="icon"
              onClick={() => onToggleSidebar(!sidebarVisible)}
              title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
              aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
              icon={isMobile ? <Menu size={20} /> : <PanelLeftOpen size={20} />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
