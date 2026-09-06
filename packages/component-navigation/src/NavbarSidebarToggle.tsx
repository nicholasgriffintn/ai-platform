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
    <div className="sticky top-0 z-10 w-full border-b border-sidebar-border bg-sidebar">
      <div className="m-2 flex max-w-full items-center justify-between">
        <div className="flex min-w-0 items-center">
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
