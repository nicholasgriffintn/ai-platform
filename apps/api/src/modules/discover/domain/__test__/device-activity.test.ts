import { describe, expect, it } from "vitest";

import {
  DEVICE_ACTIVITY_DAYS_KEPT,
  describeDeviceActivityItems,
  listDeviceActivityProviders,
  mergeDeviceActivityPages,
  parseDeviceActivityHistory,
  readDeviceActivityPages,
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

    const days = parseDeviceActivityHistory(content);

    expect(days).toHaveLength(DEVICE_ACTIVITY_DAYS_KEPT);
    expect(days[0]).toEqual({
      date: "2026-10-08",
      lines: ["Searched “lisbon” ## 2026-01-01"],
    });
    expect(days.at(-1)?.date).toBe("2026-10-02");
  });

  it("reads only pages it has not read or tried before, keeping earlier excerpts", () => {
    const items = [
      { title: "Known", url: "https://known.example/a" },
      { title: "Tried", url: "https://tried.example/sign-in" },
      { title: "New", url: "https://new.example/b" },
      { title: "site · Sitemap work", detail: "Asked: Add a sitemap" },
    ];
    const { pages, unread } = readDeviceActivityPages(
      items,
      [{ title: "Known", url: "https://known.example/a", snippet: "What it said" }],
      new Set(["https://tried.example/sign-in"]),
      "2026-10-25",
    );

    expect(unread.map((page) => page.url)).toEqual(["https://new.example/b"]);

    const read = mergeDeviceActivityPages(
      pages,
      unread.map((page) => ({ ...page, snippet: "Fresh excerpt" })),
    );

    expect(describeDeviceActivityItems(items, read)).toEqual([
      "Read “Known” (https://known.example/a): What it said",
      "Read “Tried” (https://tried.example/sign-in)",
      "Read “New” (https://new.example/b): Fresh excerpt",
      "site · Sitemap work: Asked: Add a sitemap",
    ]);
  });
});
