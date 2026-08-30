import { cn, NavLink } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export function sidebarNavLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "flex w-full items-center gap-2 rounded-lg p-2 text-sm no-underline transition-colors hover:!no-underline",
    isActive
      ? "bg-off-white-highlight text-black dark:bg-[#2D2D2D] dark:text-white"
      : "text-zinc-600 hover:bg-zinc-200 hover:text-black dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
  );
}

export function SidebarNavSection({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="space-y-1">
      {title && (
        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
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
      {shortcut && (
        <kbd className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">{shortcut}</kbd>
      )}
    </button>
  );
}
