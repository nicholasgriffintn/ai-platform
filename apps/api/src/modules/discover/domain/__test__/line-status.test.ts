import { describe, expect, it } from "vitest";

import { describeDiscoverLineStatus } from "../line-status";

const now = new Date("2026-11-09T08:00:00.000Z");

describe("describeDiscoverLineStatus", () => {
  it("reports disrupted lines first and folds the rest into one good service line", () => {
    const observations = describeDiscoverLineStatus(
      [
        {
          id: "victoria",
          name: "Victoria",
          statuses: [{ severity: 10, description: "Good Service", reason: null }],
        },
        {
          id: "northern",
          name: "Northern",
          statuses: [
            { severity: 19, description: "Information", reason: null },
            { severity: 9, description: "Minor Delays", reason: "Northern Line: Minor delays." },
          ],
        },
        {
          id: "elizabeth",
          name: "Elizabeth line",
          statuses: [{ severity: 18, description: "No Issues", reason: null }],
        },
        {
          id: "central",
          name: "Central",
          statuses: [{ severity: 6, description: "Severe Delays", reason: null }],
        },
      ],
      { lines: ["northern", "victoria", "elizabeth"], now },
    );

    expect(observations.map(({ id, source, text }) => ({ id, source, text }))).toEqual([
      { id: "lines:northern", source: "Minor Delays", text: "Northern Line: Minor delays." },
      {
        id: "lines:good",
        source: "Good service",
        text: "Good service on the Victoria line and Elizabeth line.",
      },
    ]);
  });
});
