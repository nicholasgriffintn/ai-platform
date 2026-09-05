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
  active: "border-active-work/35 bg-active-work/10 text-foreground",
  paused: "border-border bg-surface-elevated text-muted-foreground",
  stopped: "border-attention/40 bg-attention/12 text-foreground",
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
    "border-border bg-surface text-foreground hover:bg-selection rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50";

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
