import { cn, NavLink } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export function sidebarNavLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "flex w-full items-center gap-2 rounded-lg p-2 text-sm no-underline transition-colors hover:!no-underline",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground hover:text-foreground",
  );
}

export function SidebarNavSection({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="space-y-1">
      {title && (
        <p className="text-muted-foreground px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

export function SidebarNavLink({
  children,
  end,
  href,
  icon,
  onClick,
}: {
  children: ReactNode;
  end?: boolean;
  href: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <NavLink href={href} end={end} className={sidebarNavLinkClass} onClick={onClick}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </NavLink>
  );
}

export function SidebarNavButton({
  children,
  icon,
  isActive = false,
  onClick,
  shortcut,
}: {
  children: ReactNode;
  icon: ReactNode;
  isActive?: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button type="button" className={sidebarNavLinkClass({ isActive })} onClick={onClick}>
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      {shortcut && <kbd className="text-muted-foreground text-[10px] font-medium">{shortcut}</kbd>}
    </button>
  );
}
