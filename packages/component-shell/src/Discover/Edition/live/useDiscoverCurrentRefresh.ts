import { useRefreshDiscoverCurrent } from "@ngriffin_uk/polychat-library-react";
import type { DiscoverNow } from "@ngriffin_uk/polychat-schemas";
import { useCurrentTime } from "@ngriffin_uk/polychat-utility-react";
import { useEffect, useRef } from "react";

export function useDiscoverCurrentRefresh(value: DiscoverNow | undefined, enabled: boolean) {
  const { mutate } = useRefreshDiscoverCurrent();
  const requested = useRef<string | null>(null);
  const now = useCurrentTime();

  useEffect(() => {
    if (!enabled || !value || Date.parse(value.nextRefreshAt) > now.getTime()) {
      return;
    }

    const request = `${value.nextRefreshAt}:${Math.floor(now.getTime() / (5 * 60 * 1000))}`;

    if (requested.current === request || document.visibilityState !== "visible") {
      return;
    }

    requested.current = request;
    mutate();
  }, [enabled, mutate, value, now]);
}
