import { cn } from "@ngriffin_uk/polychat-component-ui";
import { Pause, Play, Target, X } from "lucide-react";

export type GoalCardStatus =
  | "active"
  | "paused"
  | "completed"
  | "cleared"
  | "blocked"
  | "stalled"
  | "limit_reached";

export interface GoalStatusCardProps {
  objective: string;
  status: GoalCardStatus;
  statusLabel: string;
  iterationCount: number;
  stoppedReason?: string | null;
  busy?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onClear?: () => void;
}

const toneClasses: Record<string, string> = {
  active:
    "border-zinc-200 bg-off-white text-zinc-700 dark:border-zinc-700 dark:bg-[#121212] dark:text-zinc-300",
  paused:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-[#121212] dark:text-zinc-400",
  stopped:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
};

function resolveTone(status: GoalCardStatus): string {
  if (status === "active") {
    return toneClasses.active;
  }

  if (status === "paused") {
    return toneClasses.paused;
  }

  return toneClasses.stopped;
}

export function GoalStatusCard({
  objective,
  status,
  statusLabel,
  iterationCount,
  stoppedReason,
  busy = false,
  onPause,
  onResume,
  onClear,
}: GoalStatusCardProps) {
  const buttonClasses =
    "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700";

  return (
    <div
      role="status"
      aria-label={`${statusLabel}: ${objective}`}
      className={cn("mb-3 rounded-lg border px-4 py-3 shadow-sm", resolveTone(status))}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Target className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{objective}</p>
            <p className="mt-0.5 text-xs opacity-80">
              {statusLabel}
              {iterationCount > 0 ? ` · ${iterationCount} iterations` : ""}
            </p>
            {stoppedReason ? <p className="mt-1 text-xs opacity-80">{stoppedReason}</p> : null}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {status === "active" && onPause ? (
            <button type="button" className={buttonClasses} disabled={busy} onClick={onPause}>
              <Pause className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Pause
            </button>
          ) : null}
          {status === "paused" && onResume ? (
            <button type="button" className={buttonClasses} disabled={busy} onClick={onResume}>
              <Play className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Resume
            </button>
          ) : null}
          {onClear ? (
            <button
              type="button"
              className={buttonClasses}
              disabled={busy}
              onClick={onClear}
              aria-label="Clear goal"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
