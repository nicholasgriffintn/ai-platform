import { shiftCalendarDate, zonedTimeToInstant } from "@ngriffin_uk/polychat-utility-core";

const EVENT_LINE = /^(\d{4}-\d{2}-\d{2}) (?:(\d{2}):(\d{2})–(\d{2}):(\d{2})|all day)(?: · |$)/u;

export interface DeviceCalendarEvent {
  line: string;
  startsAt: Date;
  endsAt: Date;
}

function at(date: string, hour: string, minute: string, timeZone: string): Date {
  const instant = zonedTimeToInstant(date, Number(hour), timeZone);

  return new Date(instant.getTime() + Number(minute) * 60 * 1000);
}

export function readUpcomingDeviceEvents(
  lines: readonly string[],
  now: Date,
  timeZone: string,
): DeviceCalendarEvent[] {
  return lines.flatMap((line) => {
    const match = EVENT_LINE.exec(line);
    const date = match?.[1];

    if (!match || !date) {
      return [];
    }

    const [, , startHour, startMinute, endHour, endMinute] = match;
    const allDay = !startHour || !startMinute || !endHour || !endMinute;
    const startsAt = allDay
      ? zonedTimeToInstant(date, 0, timeZone)
      : at(date, startHour, startMinute, timeZone);
    const ends = allDay
      ? zonedTimeToInstant(shiftCalendarDate(date, 1), 0, timeZone)
      : at(date, endHour, endMinute, timeZone);
    const endsAt =
      ends.getTime() > startsAt.getTime() ? ends : new Date(ends.getTime() + 24 * 60 * 60 * 1000);

    return endsAt.getTime() > now.getTime() ? [{ line, startsAt, endsAt }] : [];
  });
}
