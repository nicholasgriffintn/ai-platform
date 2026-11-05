import type { GoalEvidenceEntry } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { assessRunVerification, type RunVerificationInput } from "../run-verification";

const confirmed: GoalEvidenceEntry = {
  claim: "The brief was written",
  route: "Read the board with list_tasks",
  evidence_surface: "list_tasks result",
  status: "confirmed",
};

function assess(input: Partial<RunVerificationInput>) {
  return assessRunVerification({
    toolResults: [{ name: "list_tasks", status: "success" }],
    outputCount: 0,
    fileFindings: [],
    checkedAt: "2026-11-05T10:00:00.000Z",
    ...input,
  });
}

describe("assessRunVerification", () => {
  it("reports a run with no evidence as unverified, not failed or done", () => {
    expect(assess({ toolResults: [] }).status).toBe("unverified");
  });

  it("does not accept a ledger that nothing in the run backs up", () => {
    const verification = assess({
      ledger: [confirmed],
      toolResults: [
        { name: "complete_goal", status: "success" },
        { name: "list_tasks", status: "error" },
      ],
    });

    expect(verification.status).toBe("unverified");
  });

  it("needs a ledger entry that establishes the result when the run had a goal", () => {
    expect(assess({ ledger: [] }).status).toBe("unverified");
    expect(assess({ ledger: [{ ...confirmed, status: "supporting" }] }).status).toBe("unverified");
    expect(assess({ ledger: [confirmed] }).status).toBe("verified");
  });

  it("verifies a goal-less routine on its tool results or outputs", () => {
    expect(assess({}).status).toBe("verified");
    expect(assess({ toolResults: [], outputCount: 1 }).status).toBe("verified");
  });

  it("fails a run whose file did not survive a round trip, whatever the ledger says", () => {
    const verification = assess({
      ledger: [confirmed],
      fileFindings: [
        { check: "file", status: "failed", detail: "Corrupt package.", outputId: "output-1" },
      ],
    });

    expect(verification.status).toBe("failed");
  });

  it("reads council verdicts: revise fails, hold leaves it unverified, ship passes", () => {
    expect(assess({ councilVerdicts: ["ship", "revise", "hold"] }).status).toBe("failed");
    expect(assess({ councilVerdicts: ["ship", "hold"] }).status).toBe("unverified");
    expect(assess({ councilVerdicts: ["ship"] }).status).toBe("verified");
  });
});
