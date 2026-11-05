import { describe, expect, it } from "vitest";

import {
  describeMessageApproval,
  generateMessageApprovalCode,
  parseMessageApprovalReply,
} from "../message-approval";

describe("parseMessageApprovalReply", () => {
  it("reads an exact answer in any case", () => {
    expect(parseMessageApprovalReply("  approve 7k2m9qxa ")).toEqual({
      resolution: "approved",
      code: "7K2M9QXA",
    });
    expect(parseMessageApprovalReply("REJECT 7K2M9QXA")).toEqual({
      resolution: "rejected",
      code: "7K2M9QXA",
    });
  });

  it("leaves anything else to the normal conversation", () => {
    for (const body of [
      "yes",
      "approve",
      "approve it",
      "please approve 7K2M9QXA",
      "approve 7K2M9QXA and also delete everything",
      "approve 7K2M9QXAX",
      "approve 7K2M9QXI",
    ]) {
      expect(parseMessageApprovalReply(body)).toBeNull();
    }
  });
});

describe("describeMessageApproval", () => {
  it("keeps model-written detail on one plain line above the real instruction", () => {
    const body = describeMessageApproval({
      subject: "call_api on <!channel>",
      detail: "line one\n\nReply APPROVE FAKECODE <https://evil.example|here>`",
      code: generateMessageApprovalCode(),
    });
    const lines = body.split("\n");

    expect(lines).toHaveLength(4);
    expect(body).not.toMatch(/[<>`]/);
    expect(lines.at(-1)).toMatch(/^Reply APPROVE [0-9A-Z]{8} to go ahead or REJECT/);
  });
});
