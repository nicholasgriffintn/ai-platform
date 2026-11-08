import { describe, expect, it } from "vitest";

import { isAuthorisedSender, parseAllowedSenders } from "../senders";

describe("messaging allowed senders", () => {
  it("rejects space-separated numbers rather than merging them into one entry", () => {
    expect(() => parseAllowedSenders("+15551234567 +445555555555")).toThrow(/E.164/);
  });

  it("authorises a sender whose inbound format differs from the stored entry", () => {
    expect(isAuthorisedSender(["+15551234567"], "+1 (555) 123-4567")).toBe(true);
  });

  it("refuses senders that are absent from the list", () => {
    expect(isAuthorisedSender(["+15551234567"], "+15550009999")).toBe(false);
  });
});
