import type { ReactNode } from "react";

export function SidebarFooter({ children }: { children: ReactNode }) {
  return <div className="bg-zinc-50 dark:bg-zinc-900">{children}</div>;
}
