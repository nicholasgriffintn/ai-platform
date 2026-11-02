import {
  discoverDayProfileContentSchema,
  type DiscoverDayContext,
  type DiscoverDayProfileContent,
  type DiscoverMoment,
  type UpdateDiscoverDayProfile,
} from "@ngriffin_uk/polychat-schemas";
import {
  describeZonedInstant,
  isClockTimeInRange,
  normaliseComparableText,
  parseClockMinutes,
  shiftCalendarDate,
} from "@ngriffin_uk/polychat-utility-core";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function resolveDiscoverDay(
  profile: DiscoverDayProfileContent,
  now: Date,
): DiscoverDayContext {
  const local = describeZonedInstant(now, profile.timezone);
  const weekday = WEEKDAYS.indexOf(local.weekday);
  const day = profile.week.find((candidate) => candidate.weekday === weekday);
  const override = profile.overrides.find((candidate) => candidate.date === local.date);
  const clock = local.time.slice(0, 5);
  const minutes = parseClockMinutes(clock) ?? 0;
  const moments = Object.entries(profile.moments).sort((left, right) =>
    left[1].localeCompare(right[1]),
  );
  let moment: DiscoverMoment = "morning";

  for (const [name, time] of moments) {
    if (minutes >= (parseClockMinutes(time) ?? 0)) {
      if (name === "morning" || name === "lunch" || name === "afternoon" || name === "evening") {
        moment = name;
      }
    }
  }

  const mode = override?.mode ?? day?.mode ?? "off";

  return {
    date: local.date,
    timezone: profile.timezone,
    mode,
    moment,
    working: mode !== "off" && day !== undefined && isClockTimeInRange(clock, day.start, day.end),
    overridden: override !== undefined,
    outbound: override?.outbound ?? day?.outbound ?? "08:00",
    returning: override?.returning ?? day?.returning ?? "17:30",
  };
}

export function applyDiscoverDayUpdate(
  current: DiscoverDayProfileContent,
  input: UpdateDiscoverDayProfile,
  now: Date,
): DiscoverDayProfileContent {
  const {
    expectedRevision: _revision,
    enabled: _enabled,
    override,
    removeOverride,
    ...patch
  } = input;
  const today = describeZonedInstant(now, patch.timezone ?? current.timezone).date;
  const lastDate = shiftCalendarDate(today, 366);
  const overrides = current.overrides.filter(
    (candidate) =>
      candidate.date >= today &&
      candidate.date <= lastDate &&
      candidate.date !== removeOverride &&
      candidate.date !== override?.date,
  );

  if (override) {
    overrides.push(override);
  }

  const profile = discoverDayProfileContentSchema.parse({
    ...current,
    ...patch,
    overrides: overrides.sort((left, right) => left.date.localeCompare(right.date)),
  });
  const muted = new Set(profile.mutedTopics.map(normaliseComparableText));

  return {
    ...profile,
    topics: [
      ...new Map(
        profile.topics
          .filter((topic) => !muted.has(normaliseComparableText(topic)))
          .map((topic) => [normaliseComparableText(topic), topic]),
      ).values(),
    ],
    mutedTopics: [
      ...new Map(
        profile.mutedTopics.map((topic) => [normaliseComparableText(topic), topic]),
      ).values(),
    ],
  };
}

export function discoverCommuteWindow(
  profile: DiscoverDayProfileContent,
  day: DiscoverDayContext,
  now: Date,
): { direction: "outbound" | "returning"; departure: string } | null {
  if (!profile.commute || day.mode !== "office") {
    return null;
  }

  return discoverTravelWindow(day, now);
}

export function discoverTravelWindow(
  day: DiscoverDayContext,
  now: Date,
): { direction: "outbound" | "returning"; departure: string } | null {
  if (day.mode !== "office") {
    return null;
  }

  const clock = describeZonedInstant(now, day.timezone).time.slice(0, 5);
  const minutes = parseClockMinutes(clock) ?? 0;

  for (const direction of ["outbound", "returning"] as const) {
    const departure = day[direction];
    const distance = (parseClockMinutes(departure) ?? 0) - minutes;

    if (distance >= -15 && distance <= 60) {
      return { direction, departure };
    }
  }

  return null;
}

export function isDiscoverQuiet(profile: DiscoverDayProfileContent, now: Date): boolean {
  const local = describeZonedInstant(now, profile.timezone);
  const preferences = profile.notifications;

  return (
    isClockTimeInRange(local.time.slice(0, 5), preferences.quietStart, preferences.quietEnd) ||
    (preferences.quietWhileWorking && resolveDiscoverDay(profile, now).working)
  );
}
