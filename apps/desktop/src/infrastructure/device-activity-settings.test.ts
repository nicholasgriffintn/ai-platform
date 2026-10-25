import type { DeviceActivityBrowser, DeviceActivitySettings } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { withBrowserProfile, withBrowsing } from "./device-activity-settings";

const SETTINGS: DeviceActivitySettings = {
  enabled: true,
  browsing: { enabled: false, browsers: [], titles: true, searches: false },
  agents: { claudeCode: false, codex: false, prompts: false },
  apps: { enabled: false, windowTitles: false },
  music: { appleMusic: false, spotify: false },
  neverShare: { domains: [], apps: [], projects: [] },
};

const CHROME: DeviceActivityBrowser = {
  id: "chrome",
  name: "Google Chrome",
  profiles: [{ id: "Default", name: "Default" }],
};

const HELIUM: DeviceActivityBrowser = {
  id: "helium",
  name: "Helium",
  profiles: [
    { id: "Default", name: "Personal" },
    { id: "Profile 1", name: "Work" },
  ],
};

describe("device activity settings", () => {
  it("chooses Helium when browsing is first switched on", () => {
    const next = withBrowsing(SETTINGS, true, [CHROME, HELIUM]);

    expect(next.browsing.browsers).toEqual([
      { browser: "helium", profiles: ["Default", "Profile 1"] },
    ]);
  });

  it("keeps an earlier choice when browsing is switched back on", () => {
    const chosen = withBrowserProfile(SETTINGS, CHROME, "Default", true);

    expect(withBrowsing(chosen, true, [CHROME, HELIUM]).browsing.browsers).toEqual([
      { browser: "chrome", profiles: ["Default"] },
    ]);
  });

  it("drops a browser once its last profile is switched off", () => {
    const chosen = withBrowsing(SETTINGS, true, [HELIUM]);
    const one = withBrowserProfile(chosen, HELIUM, "Default", false);
    const none = withBrowserProfile(one, HELIUM, "Profile 1", false);

    expect(one.browsing.browsers).toEqual([{ browser: "helium", profiles: ["Profile 1"] }]);
    expect(none.browsing.browsers).toEqual([]);
  });
});
