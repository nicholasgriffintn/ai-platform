import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  formatZonedDayLabel,
  partOfDay,
  readZonedClock,
  parseClockMinutes,
  readLocalTimeZone,
} from "@ngriffin_uk/polychat-utility-core";
import { useCurrentTime } from "@ngriffin_uk/polychat-utility-react";

export function useDiscoverGreeting(timezone?: string) {
  const user = useChatStore((state) => state.user);
  const nickname = useChatStore((state) => state.userSettings?.nickname);
  const now = useCurrentTime();
  const zone = timezone ?? readLocalTimeZone() ?? "UTC";
  const clock = readZonedClock(now, zone);

  return {
    today: formatZonedDayLabel(now, zone),
    greeting: {
      opener: `Good ${partOfDay(Math.floor((parseClockMinutes(clock.time) ?? 0) / 60))}`,
      name: nickname?.trim() || user?.name?.trim().split(/\s+/u)[0] || null,
    },
  };
}
