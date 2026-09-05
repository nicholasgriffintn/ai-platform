import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { StreamActivity } from "@ngriffin_uk/polychat-library-chat/response-stats";
import { getStreamActivityMetrics } from "@ngriffin_uk/polychat-library-chat/response-stats";
import type { TurnActivityProjection } from "@ngriffin_uk/polychat-library-chat/turn-activity";
import { Loader2 } from "lucide-react";
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
      return;
    }

    setNow(Date.now());

    const interval = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const metrics = activity ? getStreamActivityMetrics(activity, now) : [];

  return (
    <div
      className={cn(
        "flex items-start gap-2 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400",
        className,
      )}
      data-testid="stream-activity"
    >
      <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span>{turnActivity?.label ?? label}</span>
        {metrics.length > 0 && (
          <span
            aria-hidden="true"
            className="text-xs text-zinc-500 tabular-nums dark:text-zinc-500"
          >
            {metrics.join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}
