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
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        <RadioTower className="h-4 w-4 shrink-0" />
        <span>Live</span>
        <span className="truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">
          {statusCopy}
        </span>
      </div>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "active" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-zinc-400",
        )}
        aria-hidden="true"
      />
    </div>
  );
}
