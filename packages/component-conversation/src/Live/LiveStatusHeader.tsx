import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { RealtimeLiveStatus } from "@ngriffin_uk/polychat-library-realtime/live-providers";
import { RadioTower } from "lucide-react";

export interface LiveStatusHeaderProps {
  status: RealtimeLiveStatus;
  statusCopy: string;
}

export function LiveStatusHeader({ status, statusCopy }: LiveStatusHeaderProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-1">
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
        <RadioTower className="h-4 w-4 shrink-0" />
        <span>Live</span>
        <span className="truncate text-xs font-normal text-muted-foreground">{statusCopy}</span>
      </div>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "active" ? "bg-success" : status === "error" ? "bg-failure" : "bg-selection",
        )}
        aria-hidden="true"
      />
    </div>
  );
}
