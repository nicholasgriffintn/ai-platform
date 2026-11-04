import { discoverDayProfileContentSchema } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildDiscoverScheduleTriggers } from "../schedules";

describe("Discover scheduled work", () => {
  it("rereads public feeds through the day, not just at the morning research", () => {
    const profile = discoverDayProfileContentSchema.parse({ timezone: "Europe/London" });
    const feed = buildDiscoverScheduleTriggers(profile, { listen: false, evening: false }).find(
      (trigger) => trigger.discoverOperation === "feed",
    );

    expect(feed?.cronExpression).toMatch(/^30 7,9,11,13,15,17,19,21 /u);
  });

  it("schedules audio separately from editions, including evening audio without an evening edition", () => {
    const profile = discoverDayProfileContentSchema.parse({
      timezone: "Europe/London",
      audio: {
        morning: { enabled: true, time: "07:45" },
        evening: { enabled: true, time: "20:30" },
      },
    });
    const triggers = buildDiscoverScheduleTriggers(profile, { listen: true, evening: false });

    expect(triggers.find((trigger) => trigger.id === "discover-edition-evening")).toBeUndefined();
    expect(triggers.find((trigger) => trigger.discoverOperation === "evening_audio")).toMatchObject(
      { cronExpression: "30 20 * * *", timezone: "Europe/London" },
    );
    expect(triggers.find((trigger) => trigger.discoverOperation === "morning_audio")).toMatchObject(
      { cronExpression: "45 7 * * *" },
    );
    expect(triggers.find((trigger) => trigger.id === "discover-current")).toMatchObject({
      cronExpression: "*/15 6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21 * * *",
    });
  });

  it("disables audio work without disabling current updates or scheduled editions", () => {
    const profile = discoverDayProfileContentSchema.parse({});
    const triggers = buildDiscoverScheduleTriggers(profile, { listen: false, evening: true });

    expect(
      triggers.some(
        (trigger) =>
          trigger.discoverOperation === "morning_audio" ||
          trigger.discoverOperation === "evening_audio",
      ),
    ).toBe(false);
    expect(triggers.some((trigger) => trigger.discoverOperation === "current")).toBe(true);
    expect(triggers.some((trigger) => trigger.id === "discover-edition-evening")).toBe(true);
  });
});
