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
    <div className="sticky top-0 z-10 h-[53px] w-full bg-off-white dark:bg-zinc-900">
      <div className="flex h-full items-center justify-between px-2">
        <Link
          href={homeHref}
          className="px-1 text-sm font-semibold text-zinc-700 no-underline hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white"
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
