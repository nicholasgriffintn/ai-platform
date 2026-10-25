import { describe, expect, it } from "vitest";

import { listDeviceActivityProviders, readDeviceActivitySource } from "../device-activity";

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
});
