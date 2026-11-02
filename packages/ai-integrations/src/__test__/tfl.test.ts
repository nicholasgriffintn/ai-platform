import { afterEach, describe, expect, it, vi } from "vitest";

import { executeTflOperation } from "../executors/tfl.js";

afterEach(() => vi.unstubAllGlobals());

describe("TfL journey planning", () => {
  it.each([
    ["940GZZLUWLO", "940GZZLUBNK"],
    ["Waterloo Underground", "Bank"],
    ["51.503299,-0.11478", "51.5134,-0.0889"],
  ])("accepts TfL journey locations %s to %s", async (from, to) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ journeys: [] }));

    vi.stubGlobal("fetch", fetch);
    await executeTflOperation("", "plan_journey", {
      from,
      to,
      date: "2026-11-02",
      time: "08:00",
    });

    const [request] = fetch.mock.calls;

    if (!request) {
      throw new Error("TfL was not called");
    }

    const url = new URL(request[0]);

    expect(url.pathname).toBe(
      `/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}`,
    );
    expect(url.searchParams.get("date")).toBe("20261102");
    expect(url.searchParams.get("time")).toBe("0800");
    expect(url.searchParams.has("app_key")).toBe(false);
  });

  it("returns ambiguous station choices instead of treating them as a provider failure", async () => {
    const choices = {
      toLocationDisambiguation: { disambiguationOptions: [{ matchQuality: 100 }] },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(choices, { status: 300 })));

    await expect(
      executeTflOperation("", "plan_journey", {
        from: "Waterloo",
        to: "Bank",
        date: "2026-11-02",
        time: "08:00",
      }),
    ).resolves.toEqual(choices);
  });

  it("rejects invalid departure input with a readable error before calling TfL", async () => {
    const fetch = vi.fn();

    vi.stubGlobal("fetch", fetch);

    await expect(
      executeTflOperation("", "plan_journey", {
        from: "Waterloo",
        to: "Bank",
        date: "2026-11-02",
        time: "28:00",
      }),
    ).rejects.toMatchObject({ type: "PARAMS_ERROR", message: expect.stringContaining("HH:mm") });
    expect(fetch).not.toHaveBeenCalled();
  });
});
