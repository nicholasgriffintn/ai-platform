import { describe, expect, it } from "vitest";

import { periodRange, summariseGovernance } from "../report";

describe("governance report", () => {
  it("separates runs the owner started from runs others started", () => {
    const report = summariseGovernance({
      period: "2026-10",
      generatedAt: "2026-10-22T00:00:00.000Z",
      runs: [
        { trigger: "user", status: "succeeded", count: 10 },
        { trigger: null, status: "failed", count: 1 },
        { trigger: "schedule", status: "succeeded", count: 4 },
        { trigger: "channel", status: "interrupted", count: 2 },
      ],
      approvals: [],
      standingApprovals: 0,
      spend: [],
    });

    expect(report.runs).toEqual({
      total: 17,
      failed: 3,
      startedByOthers: 6,
      byTrigger: { user: 11, schedule: 4, channel: 2 },
      byStatus: { succeeded: 14, failed: 1, interrupted: 2 },
    });
  });

  it("counts executed approvals as approved and ranks the busiest operations", () => {
    const report = summariseGovernance({
      period: "2026-10",
      generatedAt: "2026-10-22T00:00:00.000Z",
      runs: [],
      approvals: [
        { state: "consumed", provider: "gmail", operation: "send_email", count: 5 },
        { state: "approved", provider: "gmail", operation: "send_email", count: 1 },
        { state: "rejected", provider: "slack", operation: "post_message", count: 2 },
        { state: "expired", provider: "github", operation: "merge_pr", count: 1 },
        { state: "pending", provider: "slack", operation: "post_message", count: 1 },
      ],
      standingApprovals: 2,
      spend: [],
    });

    expect(report.approvals).toEqual({
      requested: 10,
      approved: 6,
      rejected: 2,
      expired: 1,
      executed: 5,
      pending: 1,
      topOperations: [
        { provider: "gmail", operation: "send_email", count: 6 },
        { provider: "slack", operation: "post_message", count: 3 },
        { provider: "github", operation: "merge_pr", count: 1 },
      ],
    });
    expect(report.standingApprovals).toBe(2);
  });

  it("totals teammate spend and flags teammates at their cap", () => {
    const report = summariseGovernance({
      period: "2026-12",
      generatedAt: "2026-12-02T00:00:00.000Z",
      runs: [],
      approvals: [],
      standingApprovals: 0,
      spend: [
        {
          teammate_context_id: "context-1",
          teammate_id: "teammate-1",
          teammate_name: "Ada",
          monthly_credit_cap_micros: 2_000_000,
          credit_micros: 2_000_000,
          run_count: 7,
        },
        {
          teammate_context_id: "context-2",
          teammate_id: null,
          teammate_name: null,
          monthly_credit_cap_micros: null,
          credit_micros: 500_000,
          run_count: 1,
        },
      ],
    });

    expect(report.spend.creditMicros).toBe(2_500_000);
    expect(
      report.spend.teammates.map((teammate) => [teammate.teammateName, teammate.state]),
    ).toEqual([
      ["Ada", "reached"],
      ["Teammate", "uncapped"],
    ]);
    expect(periodRange("2026-12")).toEqual({
      from: "2026-12-01T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
    });
  });
});
