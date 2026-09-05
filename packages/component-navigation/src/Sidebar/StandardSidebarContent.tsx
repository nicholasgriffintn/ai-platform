import { cn, Link, SidebarShell } from "@ngriffin_uk/polychat-component-ui";
import { Home } from "lucide-react";
import type { ReactNode } from "react";

export interface StandardSidebarContentProps {
  children?: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  homeHref: string;
  isMobile: boolean;
  sidebarVisible: boolean;
  onClose: () => void;
}

export function StandardSidebarContent({
  children,
  footer,
  header,
  homeHref,
  isMobile,
  sidebarVisible,
  onClose,
}: StandardSidebarContentProps) {
  return (
    <SidebarShell
      visible={sidebarVisible}
      isMobile={isMobile}
      onClose={onClose}
      header={header}
      footer={footer}
    >
      <nav className="p-2 pb-[50px]">
        <ul className="space-y-1">
          <li>
            <Link
              href={homeHref}
              className={cn(
                "block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out",
                "text-muted-foreground hover:bg-surface-elevated hover:text-foreground",
                "",
                "no-underline",
                "flex items-center",
              )}
            >
              <Home className="mr-2 h-5 w-5 flex-shrink-0" />
              <span>Back to Home</span>
            </Link>
          </li>
        </ul>
        {children && <div className="mt-4">{children}</div>}
      </nav>
    </SidebarShell>
  );
}
