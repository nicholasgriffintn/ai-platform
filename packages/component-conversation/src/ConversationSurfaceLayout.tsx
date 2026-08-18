import type { ReactNode } from "react";

export interface ConversationSurfaceLayoutProps {
  header: ReactNode;
  children: ReactNode;
}

export function ConversationSurfaceLayout({ header, children }: ConversationSurfaceLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {header}
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}
