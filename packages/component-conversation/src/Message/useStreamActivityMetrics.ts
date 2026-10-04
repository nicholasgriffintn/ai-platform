import {
  getStreamActivityMetrics,
  type StreamActivity,
} from "@ngriffin_uk/polychat-library-chat/response-stats";
import { useEffect, useState } from "react";

export function useStreamActivityMetrics(activity?: StreamActivity | null): string[] {
  const startedAt = activity?.startedAt;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === undefined) {
      return undefined;
    }

    const interval = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return activity ? getStreamActivityMetrics(activity, now) : [];
}
