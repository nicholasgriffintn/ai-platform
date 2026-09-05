import { describe, expect, it } from "vitest";

import {
  threadLeaseAcquisitionSchema,
  threadLeaseAcquireRequestSchema,
  threadLeaseOwnerRequestSchema,
} from "./thread-operations";

describe("thread lease contracts", () => {
  it("requires a bounded owner token for lease operations", () => {
    expect(
      threadLeaseAcquireRequestSchema.safeParse({
        kind: "user_message",
        ownerToken: "owner-token",
      }).success,
    ).toBe(true);
    expect(threadLeaseOwnerRequestSchema.safeParse({ ownerToken: "" }).success).toBe(false);
    expect(threadLeaseOwnerRequestSchema.safeParse({ ownerToken: "x".repeat(129) }).success).toBe(
      false,
    );
  });

  it("requires an expiry for successful acquisition", () => {
    expect(
      threadLeaseAcquisitionSchema.safeParse({
        acquired: true,
        currentOperation: "compact",
      }).success,
    ).toBe(false);
    expect(
      threadLeaseAcquisitionSchema.safeParse({
        acquired: true,
        currentOperation: "compact",
        expiresAt: "2026-09-05T01:05:00.000Z",
      }).success,
    ).toBe(true);
  });
});
