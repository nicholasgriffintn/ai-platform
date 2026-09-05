import { Button, Link } from "@ngriffin_uk/polychat-component-ui";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ReactNode } from "react";

export interface SidebarHeaderProps {
  actions?: ReactNode;
  appName: string;
  homeHref: string;
  sidebarVisible: boolean;
  onToggleSidebar: (visible: boolean) => void;
}

export function SidebarHeader({
  actions,
  appName,
  homeHref,
  sidebarVisible,
  onToggleSidebar,
}: SidebarHeaderProps) {
  return (
    <div className="bg-sidebar sticky top-0 z-10 h-[53px] w-full">
      <div className="flex h-full items-center justify-between px-2">
        <Link
          href={homeHref}
          className="text-sidebar-foreground hover:text-active-work px-1 text-sm font-semibold no-underline"
        >
          {appName}
        </Link>
        <div className="flex items-center gap-1">
          {actions}
          <Button
            type="button"
            variant="icon"
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            icon={sidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            onClick={() => onToggleSidebar(!sidebarVisible)}
          />
        </div>
      </div>
    </div>
  );
}
