import {
  DISCOVER_EVENING_GATHER_HOUR,
  DISCOVER_GATHER_HOUR,
  type DiscoverEditionTime,
} from "@ngriffin_uk/polychat-schemas";
import { shiftCalendarDate } from "@ngriffin_uk/polychat-utility-core";

export interface DiscoverGatherSlot {
  date: string;
  hour: number;
  edition: DiscoverEditionTime;
}

export function nextDiscoverGatherSlot(input: {
  date: string;
  hour: number;
  evening: boolean;
}): DiscoverGatherSlot {
  const slots: DiscoverGatherSlot[] = [
    { date: input.date, hour: DISCOVER_GATHER_HOUR, edition: "morning" },
    ...(input.evening
      ? [{ date: input.date, hour: DISCOVER_EVENING_GATHER_HOUR, edition: "evening" as const }]
      : []),
  ];

  return (
    slots.find((slot) => slot.hour > input.hour) ?? {
      date: shiftCalendarDate(input.date, 1),
      hour: DISCOVER_GATHER_HOUR,
      edition: "morning",
    }
  );
}
