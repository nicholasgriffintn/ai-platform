import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

import { ConversationSurfaceLayout } from "../ConversationSurfaceLayout.js";
import { ConversationThread, type ThreadModeConfig } from "./index.js";

export interface ConversationSurfaceProps {
  header?: ReactNode;
  sidebar?: ReactNode;
  modeConfig?: ThreadModeConfig;
  ownsWindow?: boolean;
  className?: string;
}

export function ConversationSurface({
  header,
  sidebar,
  modeConfig,
  ownsWindow = false,
  className,
}: ConversationSurfaceProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-full overflow-hidden",
        ownsWindow ? "h-dvh bg-background" : "h-full",
        className,
      )}
    >
      {sidebar}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ConversationSurfaceLayout header={header}>
          <ConversationThread modeConfig={modeConfig} />
        </ConversationSurfaceLayout>
      </div>
    </div>
  );
}
