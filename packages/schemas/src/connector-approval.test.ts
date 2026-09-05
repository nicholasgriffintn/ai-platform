import { describe, expect, it } from "vitest";

import { connectorOperationApprovalResponseSchema } from "./connector-approval";

describe("connector operation approval status", () => {
  it("preserves the exact run and operation authority", () => {
    expect(
      connectorOperationApprovalResponseSchema.parse({
        approval: {
          id: "coa_action",
          runId: "run-1",
          completionId: "conversation-1",
          provider: "gmail",
          operation: "GMAIL_SEND_EMAIL",
          state: "pending",
          createdAt: "2026-09-05T12:00:00.000Z",
          expiresAt: "2026-09-05T12:10:00.000Z",
          resolvedAt: null,
          consumedAt: null,
        },
      }),
    ).toMatchObject({
      approval: {
        runId: "run-1",
        provider: "gmail",
        operation: "GMAIL_SEND_EMAIL",
      },
    });
  });
});
