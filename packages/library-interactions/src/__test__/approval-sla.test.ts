import { describe, expect, it } from "vitest";

import {
  APPROVAL_TIMEOUT_REASON,
  evaluateApprovalSla,
  type ApprovalSlaState,
} from "../approval-sla.js";

const now = new Date("2026-06-07T12:00:00.000Z");
const at = now.toISOString();

function state(overrides: Partial<ApprovalSlaState> = {}): ApprovalSlaState {
  return { status: "pending", ...overrides };
}

describe("evaluateApprovalSla", () => {
  it("does nothing while the request is inside its SLA", () => {
    expect(
      evaluateApprovalSla(
        state({
          escalationAt: "2026-06-07T12:01:00.000Z",
          expiresAt: "2026-06-07T12:02:00.000Z",
        }),
        now,
      ),
    ).toBeNull();
  });

  it("escalates a pending request once escalationAt passes", () => {
    expect(evaluateApprovalSla(state({ escalationAt: at }), now)).toEqual({
      status: "escalated",
      escalatedAt: at,
    });
  });

  it("times out a pending request once expiresAt passes", () => {
    expect(evaluateApprovalSla(state({ expiresAt: at }), now)).toEqual({
      status: "timed_out",
      timedOutAt: at,
      resolvedAt: at,
      resolutionReason: APPROVAL_TIMEOUT_REASON,
    });
  });

  it("prefers timeout when escalation and expiry are both due", () => {
    expect(evaluateApprovalSla(state({ escalationAt: at, expiresAt: at }), now)).toEqual({
      status: "timed_out",
      escalatedAt: at,
      timedOutAt: at,
      resolvedAt: at,
      resolutionReason: APPROVAL_TIMEOUT_REASON,
    });
  });

  it("times out an already-escalated request", () => {
    expect(evaluateApprovalSla(state({ status: "escalated", expiresAt: at }), now)).toMatchObject({
      status: "timed_out",
    });
  });

  it("does not re-escalate an already-escalated request", () => {
    expect(evaluateApprovalSla(state({ status: "escalated", escalationAt: at }), now)).toBeNull();
  });
});
