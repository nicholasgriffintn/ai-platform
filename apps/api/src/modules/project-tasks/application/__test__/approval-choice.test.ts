import { describe, expect, it } from "vitest";

import { resolveApprovalChoice } from "../approvals";

const capPause = { runCap: { raiseOption: "Raise cap to 200 credits" } };

describe("resolveApprovalChoice", () => {
  it("keeps Approve and Reject for ordinary tool approvals", () => {
    expect(resolveApprovalChoice({}, { resolution: "approved" })).toEqual({
      resolution: "approved",
      option: "Approve",
    });
    expect(resolveApprovalChoice({}, { resolution: "rejected" })).toEqual({
      resolution: "rejected",
      option: "Reject",
    });
  });

  it("raises a cap from the stored option, whatever resolution the client derived", () => {
    expect(
      resolveApprovalChoice(capPause, {
        resolution: "rejected",
        option: "Raise cap to 200 credits",
      }),
    ).toEqual({ resolution: "approved", option: "Raise cap to 200 credits" });
  });

  it("maps a plain approve onto the raise, for clients that send no option", () => {
    expect(resolveApprovalChoice(capPause, { resolution: "approved" }).option).toBe(
      "Raise cap to 200 credits",
    );
  });

  it("stops the run for anything else", () => {
    expect(resolveApprovalChoice(capPause, { resolution: "rejected" })).toEqual({
      resolution: "rejected",
      option: "Stop here",
    });
  });
});
