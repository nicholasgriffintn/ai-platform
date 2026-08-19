import { describe, expect, it } from "vitest";

import { isAuthorisedSender, parseAllowedSenders } from "../senders";

describe("messaging allowed senders", () => {
  it("normalises separators and formatting into E.164 entries", () => {
    expect(parseAllowedSenders("+1 (555) 123-4567, +445555555555; 0015557654321")).toEqual([
      "+15551234567",
      "+445555555555",
      "+15557654321",
    ]);
  });

  it("drops duplicates that differ only by formatting", () => {
    expect(parseAllowedSenders("+15551234567, +1-555-123-4567")).toEqual(["+15551234567"]);
  });

  it("rejects space-separated numbers rather than merging them into one entry", () => {
    expect(() => parseAllowedSenders("+15551234567 +445555555555")).toThrow(/E.164/);
  });

  it("rejects entries that are not E.164 phone numbers", () => {
    expect(() => parseAllowedSenders("+15551234567, polychat")).toThrow(/E.164/);
  });

  it("rejects an empty allow list", () => {
    expect(() => parseAllowedSenders("  ")).toThrow(/at least one allowed sender/);
  });

  it("authorises a sender whose inbound format differs from the stored entry", () => {
    expect(isAuthorisedSender(["+15551234567"], "+1 (555) 123-4567")).toBe(true);
  });

  it("refuses senders that are absent from the list", () => {
    expect(isAuthorisedSender(["+15551234567"], "+15550009999")).toBe(false);
  });

  it("refuses every sender when the list is empty", () => {
    expect(isAuthorisedSender([], "+15551234567")).toBe(false);
  });
});
