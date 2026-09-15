import { Button, Link } from "@ngriffin_uk/polychat-component-ui";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import type { ReactNode } from "react";

export interface SidebarHeaderProps {
  actions?: ReactNode;
  appName: string;
  homeHref: string;
  sidebarVisible: boolean;
  onToggleSidebar: (visible: boolean) => void;
  onSearch?: () => void;
}

export function SidebarHeader({
  actions,
  appName,
  homeHref,
  sidebarVisible,
  onToggleSidebar,
  onSearch,
}: SidebarHeaderProps) {
  return (
    <div className="sticky top-0 z-10 h-[53px] w-full bg-sidebar">
      <div className="flex h-full items-center justify-between px-2">
        <Link
          href={homeHref}
          className="px-1 text-sm font-semibold text-sidebar-foreground no-underline hover:text-active-work"
        >
          {appName}
        </Link>
        <div className="flex items-center gap-1">
          {actions}
          {onSearch && (
            <Button
              type="button"
              variant="icon"
              title="Search (⌘K)"
              aria-label="Search"
              icon={<Search size={20} />}
              onClick={onSearch}
            />
          )}
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
