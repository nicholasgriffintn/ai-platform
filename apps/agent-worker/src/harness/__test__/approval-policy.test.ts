import { describe, expect, it } from "vitest";

import { toolNeedsApproval } from "../approval-policy";

describe("toolNeedsApproval", () => {
  it("asks before every change when supervised and before commands when edits are auto-accepted", () => {
    expect(toolNeedsApproval("read", "supervised")).toBe(false);
    expect(toolNeedsApproval("write", "supervised")).toBe(true);
    expect(toolNeedsApproval("execute", "supervised")).toBe(true);
    expect(toolNeedsApproval("write", "auto_accept_edits")).toBe(false);
    expect(toolNeedsApproval("execute", "auto_accept_edits")).toBe(true);
  });

  it("never asks in full access", () => {
    expect(toolNeedsApproval("execute", "full_access")).toBe(false);
  });
});
