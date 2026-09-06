import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

import { ConversationSurfaceLayout } from "../ConversationSurfaceLayout";
import { ConversationThread, type ThreadModeConfig } from "./index";

export interface ConversationSurfaceProps {
  /** Rendered above the thread, inside the same height context. */
  header?: ReactNode;
  /** Rendered alongside the thread, ahead of it in the reading order. */
  sidebar?: ReactNode;
  modeConfig?: ThreadModeConfig;
  /** Fill the window rather than the space a host layout has already given. */
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
