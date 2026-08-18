import { cn, Link, SidebarShell } from "@ngriffin_uk/polychat-component-ui";
import { Home } from "lucide-react";
import type { ReactNode } from "react";

export interface StandardSidebarContentProps {
  footer?: ReactNode;
  header?: ReactNode;
  homeHref: string;
  isMobile: boolean;
  sidebarVisible: boolean;
  onClose: () => void;
}

/** A sidebar for surfaces that only need a route back to the product home. */
export function StandardSidebarContent({
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
                "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                "no-underline",
                "flex items-center",
              )}
            >
              <Home className="mr-2 h-5 w-5 flex-shrink-0" />
              <span>Back to Home</span>
            </Link>
          </li>
        </ul>
      </nav>
    </SidebarShell>
  );
}
