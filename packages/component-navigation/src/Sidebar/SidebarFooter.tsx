import type { ReactNode } from "react";

export function SidebarFooter({ children }: { children: ReactNode }) {
  return <div className="bg-sidebar">{children}</div>;
}
