import { describe, expect, it } from "vitest";

import { reservePolyNotification, type PolyNotificationBudget } from "../notification-budget";

const now = Date.parse("2026-11-02T10:00:00Z");
const input = {
  id: "alert",
  category: "discover" as const,
  urgency: "high" as const,
  now,
  paused: false,
  discoverLimit: 2,
};

describe("shared Poly interruption budget", () => {
  it("shares spacing and total allowance between routine and Discover interruptions", () => {
    const budget: PolyNotificationBudget = {
      entries: [{ id: "routine", category: "routine", at: now - 60_000 }],
    };

    expect(reservePolyNotification({ ...input, budget }).admission).toEqual({
      admitted: false,
      reason: "spacing",
    });
    const full: PolyNotificationBudget = {
      entries: Array.from({ length: 5 }, (_, index) => ({
        id: `routine-${index}`,
        category: "routine",
        at: now - (index + 1) * 3_600_000,
      })),
    };

    expect(reservePolyNotification({ ...input, budget: full }).admission.reason).toBe("daily_cap");
  });

  it("enforces the Discover sub-limit and makes a retry consume one admission", () => {
    const first = reservePolyNotification({ ...input, budget: { entries: [] } });
    const retried = reservePolyNotification({ ...input, budget: first.budget });

    expect(retried.admission.admitted).toBe(true);
    expect(retried.budget.entries).toHaveLength(1);
    expect(
      reservePolyNotification({
        ...input,
        id: "another",
        now: now + 3_600_000,
        discoverLimit: 1,
        budget: first.budget,
      }).admission.reason,
    ).toBe("daily_cap");
    expect(
      reservePolyNotification({ ...input, discoverLimit: 0, budget: { entries: [] } }).admission
        .admitted,
    ).toBe(false);
  });

  it("keeps pauses authoritative and expires admissions after a rolling day", () => {
    expect(
      reservePolyNotification({ ...input, paused: true, budget: { entries: [] } }).admission.reason,
    ).toBe("paused");
    expect(
      reservePolyNotification({
        ...input,
        budget: { entries: [{ id: "old", category: "discover", at: now - 86_400_000 }] },
      }).budget.entries.map((entry) => entry.id),
    ).toEqual(["alert"]);
  });
});
