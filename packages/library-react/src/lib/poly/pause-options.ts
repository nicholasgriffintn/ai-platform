export interface PolyPauseOption {
  id: "hour" | "morning" | "week-start";
  label: string;
  until: string;
}

const MORNING_HOUR = 8;
const MONDAY = 1;

function atMorning(date: Date, daysAhead: number): Date {
  const next = new Date(date);

  next.setDate(next.getDate() + daysAhead);
  next.setHours(MORNING_HOUR, 0, 0, 0);

  return next;
}

export function buildPolyPauseOptions(now: Date): PolyPauseOption[] {
  const daysToMonday = (MONDAY - now.getDay() + 7) % 7 || 7;

  return [
    {
      id: "hour",
      label: "For an hour",
      until: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    },
    { id: "morning", label: "Until tomorrow morning", until: atMorning(now, 1).toISOString() },
    {
      id: "week-start",
      label: "Until Monday morning",
      until: atMorning(now, daysToMonday).toISOString(),
    },
  ];
}
