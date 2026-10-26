import { describe, expect, it } from "vitest";

import { parseDailyLog } from "../daily-log";
import {
  DEVICE_ACTIVITY_DAYS_KEPT,
  listDeviceActivityProviders,
  readDeviceActivitySource,
  renderDeviceActivityHistory,
} from "../device-activity";

describe("device activity providers", () => {
  it("keeps an excluded Mac source listed so it can be switched back on", () => {
    expect(listDeviceActivityProviders(["device_browsing"], ["device_music"])).toEqual([
      "browsing",
      "music",
    ]);
  });

  it("ignores connector providers and unknown device sources", () => {
    expect(listDeviceActivityProviders(["gmail", "device_fax"], ["lastfm"])).toEqual([]);
    expect(readDeviceActivitySource("device_fax")).toBeNull();
    expect(readDeviceActivitySource("lastfm")).toBeNull();
  });

  it("keeps a week of days, replacing today and keeping it through a quiet send", () => {
    let content = "";

    for (let day = 1; day <= DEVICE_ACTIVITY_DAYS_KEPT + 1; day += 1) {
      content = renderDeviceActivityHistory("Browsing on Studio Mac", content, {
        date: `2026-10-${String(day).padStart(2, "0")}`,
        lines: [`day ${day}`],
      });
    }

    content = renderDeviceActivityHistory("Browsing on Studio Mac", content, {
      date: "2026-10-08",
      lines: ["Searched “lisbon”\n## 2026-01-01"],
    });
    content = renderDeviceActivityHistory("Browsing on Studio Mac", content, {
      date: "2026-10-08",
      lines: [],
    });

    const days = parseDailyLog(content);

    expect(days).toHaveLength(DEVICE_ACTIVITY_DAYS_KEPT);
    expect(days[0]).toEqual({
      date: "2026-10-08",
      lines: ["Searched “lisbon” ## 2026-01-01"],
    });
    expect(days.at(-1)?.date).toBe("2026-10-02");
  });
});
