import {
  DISCOVER_EVENING_GATHER_HOUR,
  DISCOVER_FEED_GATHER_HOURS,
  DISCOVER_GATHER_HOUR,
  type DiscoverGatherScope,
} from "@ngriffin_uk/polychat-schemas";
import { shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";

export interface DiscoverGatherSlot {
  date: string;
  hour: number;
  scope: DiscoverGatherScope;
}

export function nextDiscoverGatherSlot(input: {
  date: string;
  hour: number;
  evening: boolean;
}): DiscoverGatherSlot {
  const slots: DiscoverGatherSlot[] = [
    { date: input.date, hour: DISCOVER_GATHER_HOUR, scope: "full" },
    ...DISCOVER_FEED_GATHER_HOURS.map((hour) => ({
      date: input.date,
      hour,
      scope: "feed" as const,
    })),
    {
      date: input.date,
      hour: DISCOVER_EVENING_GATHER_HOUR,
      scope: input.evening ? "full" : "feed",
    },
  ];

  return (
    slots.find((slot) => slot.hour > input.hour) ?? {
      date: shiftCalendarDate(input.date, 1),
      hour: DISCOVER_GATHER_HOUR,
      scope: "full",
    }
  );
}

export function discoverGatherTaskId(userId: number, slot: DiscoverGatherSlot): string {
  return slot.hour === DISCOVER_GATHER_HOUR
    ? `discover_gather_${userId}_${slot.date}`
    : `discover_gather_${userId}_${slot.date}_${slot.hour}`;
}
