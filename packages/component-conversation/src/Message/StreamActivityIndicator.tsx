import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { StreamActivity } from "@ngriffin_uk/polychat-library-chat/response-stats";
import { getStreamActivityMetrics } from "@ngriffin_uk/polychat-library-chat/response-stats";
import type { TurnActivityProjection } from "@ngriffin_uk/polychat-library-chat/turn-activity";
import { useEffect, useState } from "react";

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
  const startedAt = activity?.startedAt;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === undefined) {
      return undefined;
    }

    const interval = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const metrics = activity ? getStreamActivityMetrics(activity, now) : [];

  return (
    <div
      className={cn(
        "text-muted-foreground flex min-w-0 flex-col gap-0.5 px-4 py-2 text-sm",
        className,
      )}
      data-testid="stream-activity"
    >
      <div className="flex items-start gap-2">
        <span
          className="polychat-motion-active-execution bg-active-work mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
          aria-hidden="true"
        />
        <span className="min-w-0">{turnActivity?.label ?? label}</span>
      </div>
      {metrics.length > 0 && (
        <span aria-hidden="true" className="text-muted-foreground text-xs tabular-nums">
          {metrics.join(" · ")}
        </span>
      )}
    </div>
  );
}
