import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { StreamActivity } from "@ngriffin_uk/polychat-library-chat/response-stats";
import type { TurnActivityProjection } from "@ngriffin_uk/polychat-library-chat/turn-activity";

import { useStreamActivityMetrics } from "./useStreamActivityMetrics";

interface StreamActivityIndicatorProps {
  label: string;
  activity?: StreamActivity | null;
  className?: string;
  turnActivity?: TurnActivityProjection | null;
}

export function StreamActivityIndicator({
  label,
  activity,
  className,
  turnActivity,
}: StreamActivityIndicatorProps) {
  const metrics = useStreamActivityMetrics(activity);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 px-4 py-2 text-sm text-muted-foreground",
        className,
      )}
      data-testid="stream-activity"
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-active-work"
          aria-hidden="true"
        />
        <span className="min-w-0">{turnActivity?.label ?? label}</span>
      </div>
      {metrics.length > 0 && (
        <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
          {metrics.join(" · ")}
        </span>
      )}
    </div>
  );
}
