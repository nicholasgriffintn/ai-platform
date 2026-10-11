import { describe, expect, it } from "vitest";

import { approvalsInARow, recordApprovalOutcome } from "../earned-trust";

const NOW = Date.parse("2026-10-10T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const call = { toolName: "call_api", destination: "https://api.example.com" };

function approve(streaks: ReturnType<typeof recordApprovalOutcome>, id: string, now = NOW) {
  return recordApprovalOutcome({
    streaks,
    ...call,
    interactionId: id,
    outcome: "approved",
    now,
  });
}

describe("recordApprovalOutcome", () => {
  it("counts approvals in a row once per waiting call", () => {
    let streaks = approve([], "call_1");

    streaks = approve(streaks, "call_2");
    streaks = approve(streaks, "call_2");

    expect(approvalsInARow({ streaks, ...call, now: NOW })).toBe(2);
  });

  it("starts again after a rejection", () => {
    const streaks = recordApprovalOutcome({
      streaks: approve(approve([], "call_1"), "call_2"),
      ...call,
      interactionId: "call_3",
      outcome: "rejected",
      now: NOW,
    });

    expect(approvalsInARow({ streaks, ...call, now: NOW })).toBe(0);
    expect(approvalsInARow({ streaks: approve(streaks, "call_4"), ...call, now: NOW })).toBe(1);
  });

  it("forgets a streak left untouched for a fortnight", () => {
    const old = approve(approve([], "call_1", NOW - 20 * DAY_MS), "call_2", NOW - 15 * DAY_MS);

    expect(approvalsInARow({ streaks: old, ...call, now: NOW })).toBe(0);
    expect(approvalsInARow({ streaks: approve(old, "call_3"), ...call, now: NOW })).toBe(1);
  });

  it("keeps each destination separate", () => {
    const streaks = approve([], "call_1");

    expect(
      approvalsInARow({
        streaks,
        toolName: "call_api",
        destination: "https://other.example",
        now: NOW,
      }),
    ).toBe(0);
  });
});
