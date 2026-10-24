import { describe, expect, it } from "vitest";

import { DISCOVER_SIGNALS, type DiscoverSignal } from "../signal-catalogue";
import { listDiscoverSignalProviders, selectDiscoverSignals } from "../signal-selection";

function signal(
  partial: Partial<DiscoverSignal> & Pick<DiscoverSignal, "id" | "providerId" | "group">,
): DiscoverSignal {
  return {
    title: partial.id,
    description: "",
    operation: "read",
    parameters: () => ({}),
    digest: () => [],
    ...partial,
  };
}

const SIGNALS = [
  signal({ id: "gmail", providerId: "gmail", group: "mail" }),
  signal({ id: "outlook-mail", providerId: "outlook", group: "mail" }),
  signal({ id: "outlook-calendar", providerId: "outlook", group: "calendar" }),
  signal({ id: "lastfm", providerId: "lastfm", group: "listening" }),
  signal({ id: "marquee", providerId: "marquee", group: "watching" }),
  signal({ id: "weather", providerId: "openweather_api", group: "places", needsLocation: true }),
];

describe("selectDiscoverSignals", () => {
  it("keeps every connected, supported signal and one provider per exclusive group", () => {
    const { selected, unsupported } = selectDiscoverSignals({
      signals: SIGNALS,
      connectedProviders: new Set(["gmail", "outlook", "lastfm", "marquee", "openweather_api"]),
      excludedProviders: new Set(["lastfm"]),
      supports: (provider) => provider !== "marquee",
      hasLocation: false,
    });

    expect(selected.map((item) => item.id)).toEqual(["gmail", "outlook-calendar"]);
    expect(unsupported.map((item) => item.id)).toEqual(["marquee"]);
  });

  it("falls back to the next connected provider in an exclusive group", () => {
    const { selected } = selectDiscoverSignals({
      signals: SIGNALS,
      connectedProviders: new Set(["outlook", "openweather_api"]),
      excludedProviders: new Set(),
      supports: () => true,
      hasLocation: true,
    });

    expect(selected.map((item) => item.id)).toEqual([
      "outlook-mail",
      "outlook-calendar",
      "weather",
    ]);
  });
});

describe("DISCOVER_SIGNALS", () => {
  it("lists each provider once with its group", () => {
    const providers = listDiscoverSignalProviders(DISCOVER_SIGNALS);

    expect(new Set(providers.map((provider) => provider.providerId)).size).toBe(providers.length);
    expect(providers.find((provider) => provider.providerId === "marquee")?.group).toBe("watching");
  });

  it("digests a Marquee week into one line per entry", () => {
    const week = DISCOVER_SIGNALS.find((item) => item.id === "marquee-week");

    expect(
      week?.digest({
        days: 7,
        entries: [
          {
            kind: "episode",
            titleId: "show:1",
            title: "Slow Horses",
            season: 5,
            episode: 3,
            name: "Hello Goodbye",
            when: "2026-10-26T21:00:00Z",
            precision: "time",
            network: "Apple TV+",
          },
        ],
      }),
    ).toEqual(["2026-10-26 21:00 · Slow Horses · S5E3 · Hello Goodbye · Apple TV+"]);
  });
});
