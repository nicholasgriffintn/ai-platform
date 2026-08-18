import { describe, expect, it } from "vitest";

import { connectorOperationRequiresApproval, connectorProviders } from "../..";

describe("Composio operation policy metadata", () => {
  it("exposes every upstream policy hint as an exact boolean without changing access", () => {
    const providers = connectorProviders.filter(
      (provider) => provider.auth.authType === "composio",
    );

    expect(providers.length).toBeGreaterThan(0);
    for (const provider of providers) {
      for (const operation of provider.operations) {
        expect(operation).toMatchObject({
          readOnly: expect.any(Boolean),
          destructive: expect.any(Boolean),
          idempotent: expect.any(Boolean),
          openWorld: expect.any(Boolean),
        });
        expect(operation.access).toBe(operation.readOnly ? "read" : "write");
      }
    }
  });

  it("requires approval for writes, destructive reads, and unknown operations", () => {
    expect(connectorOperationRequiresApproval("gmail", "GMAIL_FETCH_EMAILS")).toBe(false);
    expect(connectorOperationRequiresApproval("gmail", "GMAIL_CREATE_EMAIL_DRAFT")).toBe(true);
    expect(connectorOperationRequiresApproval("linear", "LINEAR_RUN_QUERY_OR_MUTATION")).toBe(true);
    expect(connectorOperationRequiresApproval("gmail", "GMAIL_UNKNOWN_OPERATION")).toBe(true);
  });
});
