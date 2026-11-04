import type {
  DiscoverDayProfileContent,
  RecipeInstallationTrigger,
} from "@ngriffin_uk/polychat-schemas";
import {
  clockTimeToDailyCron,
  parseClockMinutes,
  shiftClockTime,
} from "@ngriffin_uk/polychat-utility-core";

export function keepDiscoverTriggerState(
  triggers: readonly RecipeInstallationTrigger[],
  current: readonly RecipeInstallationTrigger[],
): RecipeInstallationTrigger[] {
  return triggers.map((trigger) => ({
    ...trigger,
    enabled: current.find((candidate) => candidate.id === trigger.id)?.enabled ?? trigger.enabled,
  }));
}

export function buildDiscoverScheduleTriggers(
  profile: DiscoverDayProfileContent,
  input: { listen: boolean; evening: boolean },
): RecipeInstallationTrigger[] {
  const hours = new Set(Array.from({ length: 16 }, (_, index) => index + 6));
  const commuteTimes = profile.commute
    ? [
        ...profile.week.filter((day) => day.mode === "office"),
        ...profile.overrides.filter((day) => day.mode === "office"),
      ]
    : [];

  for (const day of commuteTimes) {
    for (const clock of [day.outbound, day.returning]) {
      const departure = clock ? parseClockMinutes(clock) : null;

      if (departure === null) {
        continue;
      }

      for (const offset of [-60, -30, 0, 15]) {
        hours.add(Math.floor(((departure + offset + 1440) % 1440) / 60));
      }
    }
  }

  for (const clock of Object.values(profile.moments)) {
    hours.add(Number(clock.slice(0, 2)));
  }

  const triggers: RecipeInstallationTrigger[] = [
    {
      id: "discover-research-morning",
      type: "schedule",
      enabled: true,
      cronExpression: clockTimeToDailyCron(shiftClockTime(profile.moments.morning, -60)),
      timezone: profile.timezone,
      discoverOperation: "research",
    },
    {
      id: "discover-edition-morning",
      type: "schedule",
      enabled: true,
      cronExpression: clockTimeToDailyCron(profile.moments.morning),
      timezone: profile.timezone,
    },
    {
      id: "discover-current",
      type: "schedule",
      enabled: true,
      cronExpression: `*/15 ${[...hours].sort((left, right) => left - right).join(",")} * * *`,
      timezone: profile.timezone,
      discoverOperation: "current",
    },
  ];

  for (const [moment, clock] of Object.entries(profile.moments)) {
    triggers.push({
      id: `discover-current-${moment}`,
      type: "schedule",
      enabled: true,
      cronExpression: clockTimeToDailyCron(clock),
      timezone: profile.timezone,
      discoverOperation: "current",
    });
  }

  if (input.evening) {
    triggers.push({
      id: "discover-research-evening",
      type: "schedule",
      enabled: true,
      cronExpression: clockTimeToDailyCron(shiftClockTime(profile.moments.evening, -60)),
      timezone: profile.timezone,
      discoverOperation: "research",
    });
    triggers.push({
      id: "discover-edition-evening",
      type: "schedule",
      enabled: true,
      cronExpression: clockTimeToDailyCron(profile.moments.evening),
      timezone: profile.timezone,
    });
  }

  for (const slot of ["morning", "evening"] as const) {
    if (input.listen && profile.audio[slot].enabled) {
      triggers.push({
        id: `discover-audio-${slot}`,
        type: "schedule",
        enabled: true,
        cronExpression: clockTimeToDailyCron(profile.audio[slot].time),
        timezone: profile.timezone,
        discoverOperation: slot === "morning" ? "morning_audio" : "evening_audio",
      });
    }
  }

  return triggers;
}
