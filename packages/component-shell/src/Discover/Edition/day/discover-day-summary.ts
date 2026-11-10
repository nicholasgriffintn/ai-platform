import type { DiscoverDayProfile } from "@ngriffin_uk/polychat-schemas";

export function describeDiscoverWeek(profile: DiscoverDayProfile): string {
  const office = profile.week.filter((day) => day.mode === "office").length;
  const remote = profile.week.filter((day) => day.mode === "remote").length;

  if (office === 0 && remote === 0) {
    return "No working days";
  }

  return [office ? `${office} office` : null, remote ? `${remote} at home` : null]
    .filter(Boolean)
    .join(" · ");
}

export function describeDiscoverAudio(profile: DiscoverDayProfile, enabled = true): string {
  if (!enabled) {
    return "Off";
  }

  return (
    [
      profile.audio.morning.enabled ? `Morning ${profile.audio.morning.time}` : null,
      profile.audio.evening.enabled ? `Evening ${profile.audio.evening.time}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Off"
  );
}

export function describeDiscoverAlerts(profile: DiscoverDayProfile): string {
  return profile.notifications.enabled && profile.notifications.dailyLimit > 0
    ? `Up to ${profile.notifications.dailyLimit} a day`
    : "Off";
}

export function describeDiscoverLines(profile: DiscoverDayProfile): string {
  if (!profile.lineStatus.enabled) {
    return "Off";
  }

  const count = profile.lineStatus.lines.length;

  return (
    [
      count ? `${count} ${count === 1 ? "line" : "lines"}` : null,
      profile.lineStatus.nearby ? "Nearby" : null,
    ]
      .filter(Boolean)
      .join(" · ") || "No lines chosen"
  );
}
