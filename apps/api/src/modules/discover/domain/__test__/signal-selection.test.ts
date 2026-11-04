import { describe, expect, it } from "vitest";

import { DISCOVER_SIGNALS } from "../signal-catalogue";
import { listDiscoverSignalProviders, selectDiscoverSignals } from "../signal-selection";
import type { DiscoverConnectorSignal, DiscoverSignal } from "../signal-sources/types";

function signal(
  partial: Partial<DiscoverConnectorSignal> &
    Pick<DiscoverConnectorSignal, "id" | "providerId" | "group">,
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
  signal({ id: "trakt", providerId: "trakt", group: "watching" }),
  signal({ id: "weather", providerId: "openweather_api", group: "places", needsLocation: true }),
];

describe("selectDiscoverSignals", () => {
  it("keeps every connected, supported signal and one provider per exclusive group", () => {
    const { selected, unsupported } = selectDiscoverSignals({
      signals: SIGNALS,
      connectedProviders: new Set(["gmail", "outlook", "lastfm", "trakt", "openweather_api"]),
      excludedProviders: new Set(["lastfm"]),
      includedProviders: new Set(),
      supports: (provider) => provider !== "trakt",
      hasLocation: false,
    });

    expect(selected.map((item) => item.id)).toEqual(["gmail", "outlook-calendar"]);
    expect(unsupported.map((item) => item.id)).toEqual(["trakt"]);
  });

  it("falls back to the next connected provider in an exclusive group", () => {
    const { selected } = selectDiscoverSignals({
      signals: SIGNALS,
      connectedProviders: new Set(["outlook", "openweather_api"]),
      excludedProviders: new Set(),
      includedProviders: new Set(),
      supports: () => true,
      hasLocation: true,
    });

    expect(selected.map((item) => item.id)).toEqual([
      "outlook-mail",
      "outlook-calendar",
      "weather",
    ]);
  });

  it("reads a public source only once it is switched on, without needing a connection", () => {
    const publicSignal: DiscoverSignal = {
      kind: "public",
      id: "hackernews-front",
      providerId: "hackernews",
      group: "reading",
      title: "Hacker News",
      description: "",
      format: "json",
      url: () => "https://example.com/front.json",
      digest: () => [],
    };
    const select = (included: string[], excluded: string[]) =>
      selectDiscoverSignals({
        signals: [publicSignal],
        connectedProviders: new Set(),
        excludedProviders: new Set(excluded),
        includedProviders: new Set(included),
        supports: () => false,
        hasLocation: false,
      }).selected.map((item) => item.id);

    expect(select([], [])).toEqual([]);
    expect(select(["hackernews"], [])).toEqual(["hackernews-front"]);
    expect(select(["hackernews"], ["hackernews"])).toEqual([]);
  });
});

describe("DISCOVER_SIGNALS", () => {
  it("lists each provider once with its group", () => {
    const providers = listDiscoverSignalProviders(DISCOVER_SIGNALS);

    expect(new Set(providers.map((provider) => provider.providerId)).size).toBe(providers.length);
    expect(providers.find((provider) => provider.providerId === "watching")?.group).toBe(
      "watching",
    );
  });

  it("digests the week ahead into one line per entry", () => {
    const week = DISCOVER_SIGNALS.find((item) => item.id === "watching-week");

    expect(
      week?.digest({
        days: 7,
        entries: [
          {
            kind: "episode",
            titleId: "tv:1",
            title: "Slow Horses",
            season: 5,
            episode: 3,
            name: "Hello Goodbye",
            when: "2026-10-26",
          },
        ],
      }),
    ).toEqual(["2026-10-26 · Slow Horses · S5E3 · Hello Goodbye"]);
  });
});
